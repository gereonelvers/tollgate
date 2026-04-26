import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { NWCClient } from "@getalby/sdk";

/**
 * Wallet config the MCP server uses to pay/receive on the agent's behalf.
 *
 * Loaded in this order:
 *   1. ~/.tollgate/wallet.json (or $TOLLGATE_DATA_DIR/wallet.json)
 *      — written by `npx @agents402/setup` after the user pairs a wallet
 *      from the agents402 web app.
 *   2. AGENT_NWC_URL env var — backward-compat path for users who set up
 *      manually before the CLI flow existed.
 *
 * Supported providers: "nwc", "spark", "dev-fake".
 */

type WalletConfig =
  | {
      provider: "nwc";
      nwc_url: string;
      label?: string;
    }
  | {
      provider: "spark";
      spark_mnemonic: string;
      spark_network?: "MAINNET" | "TESTNET" | "SIGNET" | "REGTEST" | "LOCAL";
      spark_address?: string;
      spark_identity_pubkey?: string;
      label?: string;
    }
  | {
      provider: "dev-fake";
      label?: string;
    };

let cachedConfig: WalletConfig | null = null;
let nwcClient: NWCClient | null = null;
// Spark wallet is loaded lazily because the SDK does network I/O on init.
// Promise so concurrent callers wait on the same init.
let sparkPromise: Promise<unknown> | null = null;
// In-memory dev-fake balance, for the offline path.
let devFakeBalanceMsats = 100_000;

function configPath(): string {
  const dir = process.env.TOLLGATE_DATA_DIR || path.join(os.homedir(), ".tollgate");
  return path.join(dir, "wallet.json");
}

function loadConfig(): WalletConfig {
  if (cachedConfig) return cachedConfig;

  // Disk first.
  const p = configPath();
  if (fs.existsSync(p)) {
    try {
      const raw = JSON.parse(fs.readFileSync(p, "utf8")) as WalletConfig;
      if (!raw?.provider) throw new Error("missing 'provider'");
      cachedConfig = raw;
      process.stderr.write(
        `wallet: loaded ${p} (provider=${raw.provider})\n`,
      );
      return raw;
    } catch (e) {
      throw new Error(
        `wallet config at ${p} is malformed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // Env fallback (legacy NWC-only path).
  const url = process.env.AGENT_NWC_URL;
  if (url) {
    cachedConfig = { provider: "nwc", nwc_url: url };
    process.stderr.write(
      `wallet: loaded NWC URL from AGENT_NWC_URL env var (no ${p} present)\n`,
    );
    return cachedConfig;
  }

  throw new Error(
    `No wallet configured. Run 'npx @agents402/setup' to pair a wallet, or set AGENT_NWC_URL in your MCP env.`,
  );
}

/* ------------------------------------------------------------------ */
/* NWC path                                                            */
/* ------------------------------------------------------------------ */

function getNwcClient(): NWCClient {
  if (nwcClient) return nwcClient;
  const cfg = loadConfig();
  if (cfg.provider !== "nwc") throw new Error("getNwcClient called for non-NWC config");
  nwcClient = new NWCClient({ nostrWalletConnectUrl: cfg.nwc_url });
  return nwcClient;
}

/* ------------------------------------------------------------------ */
/* Spark path                                                          */
/* ------------------------------------------------------------------ */

async function getSparkWallet(): Promise<unknown> {
  const cfg = loadConfig();
  if (cfg.provider !== "spark") throw new Error("getSparkWallet called for non-Spark config");
  if (sparkPromise) return sparkPromise;
  sparkPromise = (async () => {
    const { SparkWallet, Network } = await import("@buildonspark/spark-sdk");
    const networkName = (cfg.spark_network ?? "MAINNET") as keyof typeof Network;
    const { wallet } = await SparkWallet.initialize({
      mnemonicOrSeed: cfg.spark_mnemonic,
      // Network[name] returns the numeric enum; the SDK accepts both.
      options: { network: networkName as unknown as never },
    });
    return wallet;
  })();
  return sparkPromise;
}

/* ------------------------------------------------------------------ */
/* Public API — same shape as before                                   */
/* ------------------------------------------------------------------ */

export async function payInvoice(
  invoice: string,
): Promise<{ preimage: string; fees_paid_msats: number }> {
  const cfg = loadConfig();
  if (cfg.provider === "nwc") {
    const r = await getNwcClient().payInvoice({ invoice });
    return { preimage: r.preimage, fees_paid_msats: r.fees_paid ?? 0 };
  }
  if (cfg.provider === "spark") {
    type SparkSendable = {
      payLightningInvoice(p: { invoice: string; maxFeeSats: number }): Promise<{ id: string }>;
      getLightningSendRequest(id: string): Promise<{ paymentPreimage?: string; feeSats?: number; status?: string } | null>;
    };
    const w = (await getSparkWallet()) as SparkSendable;
    const r = await w.payLightningInvoice({ invoice, maxFeeSats: 5 });
    // Spark settles asynchronously; poll for preimage.
    for (let i = 0; i < 12; i++) {
      const state = await w.getLightningSendRequest(r.id);
      if (state?.paymentPreimage) {
        return {
          preimage: state.paymentPreimage,
          fees_paid_msats: (state.feeSats ?? 0) * 1000,
        };
      }
      if (state?.status === "FAILED") {
        throw new Error("Spark Lightning payment failed");
      }
      await new Promise((res) => setTimeout(res, 800));
    }
    throw new Error("Spark Lightning payment did not settle within ~10s");
  }
  if (cfg.provider === "dev-fake") {
    // Fake successful payment; debit a flat 1 sat for visibility.
    devFakeBalanceMsats -= 1000;
    return { preimage: "f".repeat(64), fees_paid_msats: 0 };
  }
  throw new Error(`Unknown wallet provider: ${(cfg as { provider?: string }).provider}`);
}

export async function getBalance(): Promise<{ balance_msats: number }> {
  const cfg = loadConfig();
  if (cfg.provider === "nwc") {
    const r = await getNwcClient().getBalance();
    return { balance_msats: r.balance };
  }
  if (cfg.provider === "spark") {
    const w = (await getSparkWallet()) as { getBalance(): Promise<{ balance?: bigint | number }> };
    const r = await w.getBalance();
    const sats = typeof r.balance === "bigint" ? Number(r.balance) : (r.balance ?? 0);
    return { balance_msats: sats * 1000 };
  }
  if (cfg.provider === "dev-fake") {
    return { balance_msats: devFakeBalanceMsats };
  }
  throw new Error(`Unknown wallet provider: ${(cfg as { provider?: string }).provider}`);
}

export function getProviderTag(): string {
  return loadConfig().provider;
}

export function getWalletLabel(): string | undefined {
  return loadConfig().label;
}

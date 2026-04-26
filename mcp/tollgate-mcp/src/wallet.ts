import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import { NWCClient } from "@getalby/sdk";

/**
 * Wallet config the MCP server uses to pay/receive on the agent's behalf.
 *
 * Loaded in this order:
 *   1. ~/.tollgate/wallet.json (or $TOLLGATE_DATA_DIR/wallet.json) — written
 *      by an in-band setup tool (`wallet_setup_nwc`, `wallet_setup_browser`)
 *      or by `npx @agents402/setup`.
 *   2. AGENT_NWC_URL env var — backward-compat path for users who set up
 *      manually before the in-band flow existed.
 *
 * Supported providers: "nwc", "spark", "dev-fake".
 */

type NwcConfig = { provider: "nwc"; nwc_url: string; label?: string };
type SparkConfig = {
  provider: "spark";
  spark_mnemonic: string;
  spark_network?: "MAINNET" | "TESTNET" | "SIGNET" | "REGTEST" | "LOCAL";
  spark_address?: string;
  spark_identity_pubkey?: string;
  label?: string;
};
type DevFakeConfig = { provider: "dev-fake"; label?: string };
type WalletConfig = NwcConfig | SparkConfig | DevFakeConfig;

let cachedConfig: WalletConfig | null = null;
let nwcClient: NWCClient | null = null;
// Spark wallet is loaded lazily because the SDK does network I/O on init.
// Promise so concurrent callers wait on the same init.
let sparkPromise: Promise<unknown> | null = null;
// In-memory dev-fake balance, for the offline path.
let devFakeBalanceMsats = 100_000;

function dataDir(): string {
  return process.env.TOLLGATE_DATA_DIR || path.join(os.homedir(), ".tollgate");
}
function configPath(): string {
  return path.join(dataDir(), "wallet.json");
}

function readConfigFromDisk(): WalletConfig | null {
  const p = configPath();
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as WalletConfig;
  if (!raw?.provider) throw new Error("missing 'provider'");
  return raw;
}

function loadConfig(): WalletConfig {
  if (cachedConfig) return cachedConfig;

  const p = configPath();
  if (fs.existsSync(p)) {
    try {
      const raw = readConfigFromDisk()!;
      cachedConfig = raw;
      process.stderr.write(`wallet: loaded ${p} (provider=${raw.provider})\n`);
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
    `No wallet configured. Call wallet_setup_nwc or wallet_setup_browser to pair one, or run 'npx @agents402/setup' externally.`,
  );
}

function clearWalletCache(): void {
  cachedConfig = null;
  nwcClient = null;
  sparkPromise = null;
}

function writeConfig(cfg: WalletConfig): void {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), { mode: 0o600 });
  clearWalletCache();
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export type WalletStatus =
  | { configured: false; reason: "no_config"; config_path: string }
  | { configured: true; provider: WalletConfig["provider"]; label?: string; source: "disk" | "env" };

export function isWalletConfigured(): boolean {
  if (cachedConfig) return true;
  if (fs.existsSync(configPath())) return true;
  if (process.env.AGENT_NWC_URL) return true;
  return false;
}

export function getWalletStatus(): WalletStatus {
  try {
    if (fs.existsSync(configPath())) {
      const raw = readConfigFromDisk()!;
      return {
        configured: true,
        provider: raw.provider,
        label: raw.label,
        source: "disk",
      };
    }
  } catch (e) {
    return {
      configured: false,
      reason: "no_config",
      config_path: configPath(),
    };
  }
  if (process.env.AGENT_NWC_URL) {
    return { configured: true, provider: "nwc", source: "env" };
  }
  return { configured: false, reason: "no_config", config_path: configPath() };
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
      options: { network: networkName as unknown as never },
    });
    return wallet;
  })();
  return sparkPromise;
}

/* ------------------------------------------------------------------ */
/* Save helpers used by setup tools                                    */
/* ------------------------------------------------------------------ */

/**
 * Save an NWC wallet. Validates by calling getBalance against the URL before
 * persisting — a malformed or revoked URI fails fast instead of silently.
 */
export async function saveNwcConfig(opts: {
  nwc_url: string;
  label?: string;
}): Promise<{ balance_msats: number }> {
  const probe = new NWCClient({ nostrWalletConnectUrl: opts.nwc_url });
  let balance_msats: number;
  try {
    const r = await probe.getBalance();
    balance_msats = r.balance;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`NWC URL did not work: ${msg}`);
  }
  writeConfig({ provider: "nwc", nwc_url: opts.nwc_url, label: opts.label });
  return { balance_msats };
}

/**
 * Save a Spark wallet from raw config (used by the browser-pairing listener).
 */
export function saveSparkConfig(cfg: Omit<SparkConfig, "provider">): void {
  writeConfig({ provider: "spark", ...cfg });
}

/* ------------------------------------------------------------------ */
/* Browser pairing listener                                            */
/* ------------------------------------------------------------------ */

type PairingState = {
  port: number;
  state: string;
  url: string;
  startedAt: number;
  receivedAt?: number;
  error?: string;
  server: http.Server;
  timer: NodeJS.Timeout;
};

let activePairing: PairingState | null = null;

const DEFAULT_WEB_URL = "https://wallet.faregate.org";
const PAIRING_TIMEOUT_MS = 5 * 60 * 1000;

function corsHeaders(origin: string | undefined): Record<string, string> {
  return {
    "access-control-allow-origin": origin || "*",
    "access-control-allow-methods": "POST, OPTIONS, GET",
    "access-control-allow-headers": "content-type, x-agents402-state",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {
    // best-effort; ignore failures (the agent surfaces the URL anyway).
  });
}

export async function startBrowserPairing(opts?: {
  web_url?: string;
}): Promise<{ url: string; state: string; port: number; web_url: string }> {
  if (activePairing) {
    return {
      url: activePairing.url,
      state: activePairing.state,
      port: activePairing.port,
      web_url: opts?.web_url ?? process.env.AGENTS402_WEB_URL ?? DEFAULT_WEB_URL,
    };
  }

  const state = crypto.randomBytes(16).toString("hex");
  const webUrl = opts?.web_url ?? process.env.AGENTS402_WEB_URL ?? DEFAULT_WEB_URL;

  const server = http.createServer((req, res) => {
    const origin = req.headers.origin as string | undefined;
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders(origin));
      res.end();
      return;
    }
    if (!req.url?.startsWith("/cb")) {
      res.writeHead(404, corsHeaders(origin));
      res.end("not found");
      return;
    }
    if (req.method === "GET") {
      res.writeHead(200, { "content-type": "text/plain", ...corsHeaders(origin) });
      res.end("agents402-mcp pairing listener ready\n");
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, corsHeaders(origin));
      res.end("method not allowed");
      return;
    }

    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const stateHeader = (req.headers["x-agents402-state"] as string | undefined) ?? "";
        if (stateHeader !== state) {
          res.writeHead(403, { "content-type": "text/plain", ...corsHeaders(origin) });
          res.end("state token mismatch");
          if (activePairing) activePairing.error = "state_mismatch";
          return;
        }
        const cfg = JSON.parse(body) as WalletConfig;
        if (!cfg.provider) throw new Error("missing 'provider'");
        writeConfig(cfg);
        res.writeHead(200, { "content-type": "text/plain", ...corsHeaders(origin) });
        res.end("paired");
        if (activePairing) {
          activePairing.receivedAt = Date.now();
          // Close the server soon — let the response flush first.
          setTimeout(() => activePairing?.server.close(), 100);
        }
        process.stderr.write(
          `wallet: paired via browser (provider=${cfg.provider})\n`,
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        res.writeHead(400, { "content-type": "text/plain", ...corsHeaders(origin) });
        res.end(msg);
        if (activePairing) activePairing.error = msg;
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const callback = `http://127.0.0.1:${port}/cb`;
  const url = `${webUrl}/setup/new?callback=${encodeURIComponent(callback)}&state=${state}`;

  const timer = setTimeout(() => {
    if (activePairing && !activePairing.receivedAt) {
      activePairing.error = "timeout";
      activePairing.server.close();
      activePairing = null;
    }
  }, PAIRING_TIMEOUT_MS);
  // Don't keep the Node process alive solely for the listener.
  timer.unref();

  activePairing = { port, state, url, startedAt: Date.now(), server, timer };
  server.on("close", () => {
    if (activePairing?.server === server) {
      clearTimeout(activePairing.timer);
      // Keep activePairing around briefly so getBrowserPairingStatus can
      // report the result, then null out next call after success.
    }
  });

  // Fire-and-forget browser launch.
  openBrowser(url);

  return { url, state, port, web_url: webUrl };
}

export type PairingStatus =
  | { active: false; configured: boolean }
  | { active: true; status: "waiting" | "linked" | "failed"; url: string; error?: string; configured: boolean };

export function getBrowserPairingStatus(): PairingStatus {
  const configured = isWalletConfigured();
  if (!activePairing) return { active: false, configured };
  if (activePairing.error) {
    const out: PairingStatus = {
      active: true,
      status: "failed",
      url: activePairing.url,
      error: activePairing.error,
      configured,
    };
    activePairing = null;
    return out;
  }
  if (activePairing.receivedAt) {
    const out: PairingStatus = {
      active: true,
      status: "linked",
      url: activePairing.url,
      configured: true,
    };
    activePairing = null;
    return out;
  }
  return {
    active: true,
    status: "waiting",
    url: activePairing.url,
    configured,
  };
}

export function cancelBrowserPairing(): { cancelled: boolean } {
  if (!activePairing) return { cancelled: false };
  activePairing.server.close();
  activePairing = null;
  return { cancelled: true };
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

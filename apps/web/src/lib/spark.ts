/**
 * Browser-side helpers for the Spark wallet — thin wrappers around
 * @buildonspark/spark-sdk. Lives in apps/web because Spark wallets in this
 * onboarding flow are intentionally client-only: the mnemonic is generated
 * in the browser, stored in localStorage, and never sent to our server.
 *
 * For MCP-side payments the same mnemonic can be re-imported into a Node
 * SparkWallet (the SDK supports both runtimes).
 */
"use client";

import type { StoredWallet } from "./storage";

export type SparkInitResult = {
  mnemonic: string;
  address: string;
  identity_pubkey: string;
};

let activeWalletPromise: Promise<unknown> | null = null;
let activeWalletKey: string | null = null;

/**
 * Lazily import the SDK so it's only fetched in the browser, not during
 * Next.js's SSR pass.
 */
async function loadSdk() {
  // dynamic import — Spark SDK browser bundle includes WASM
  const mod = await import("@buildonspark/spark-sdk");
  return mod;
}

/**
 * Create a brand-new Spark wallet (generates a fresh mnemonic) on the given
 * network. Returns the mnemonic, Spark address, and identity pubkey.
 *
 * The SDK keeps the wallet object alive after this; subsequent calls in this
 * session can use `useSparkWallet({...})` with the returned mnemonic.
 */
export async function createNewSparkWallet(
  network: NonNullable<StoredWallet["spark_network"]> = "MAINNET",
): Promise<SparkInitResult> {
  const { SparkWallet } = await loadSdk();
  const { wallet, mnemonic } = await SparkWallet.initialize({
    options: { network },
  });
  if (!mnemonic) throw new Error("SparkWallet did not return a mnemonic");
  const [address, identity] = await Promise.all([
    wallet.getSparkAddress(),
    wallet.getIdentityPublicKey(),
  ]);
  cacheWallet(mnemonic, network, wallet);
  return { mnemonic, address: String(address), identity_pubkey: String(identity) };
}

/** Restore an existing wallet from a stored mnemonic. */
export async function loadSparkWallet(
  mnemonic: string,
  network: NonNullable<StoredWallet["spark_network"]> = "MAINNET",
): Promise<unknown> {
  const cacheKey = `${network}/${mnemonic}`;
  if (activeWalletKey === cacheKey && activeWalletPromise) return activeWalletPromise;
  const promise = (async () => {
    const { SparkWallet } = await loadSdk();
    const { wallet } = await SparkWallet.initialize({
      options: { network },
      mnemonicOrSeed: mnemonic,
    });
    return wallet;
  })();
  activeWalletKey = cacheKey;
  activeWalletPromise = promise;
  return promise;
}

function cacheWallet(
  mnemonic: string,
  network: NonNullable<StoredWallet["spark_network"]>,
  wallet: unknown,
) {
  activeWalletKey = `${network}/${mnemonic}`;
  activeWalletPromise = Promise.resolve(wallet);
}

export async function getSparkBalance(stored: StoredWallet): Promise<number> {
  if (!stored.spark_mnemonic) throw new Error("No mnemonic on this wallet");
  const w = (await loadSparkWallet(stored.spark_mnemonic, stored.spark_network ?? "MAINNET")) as {
    getBalance(): Promise<{ balance?: bigint | number }>;
  };
  const r = await w.getBalance();
  // Spark returns sats; we use msats internally.
  const bal = typeof r.balance === "bigint" ? Number(r.balance) : (r.balance ?? 0);
  return bal * 1000;
}

export async function createSparkLightningInvoice(
  stored: StoredWallet,
  opts: { amountSats: number; memo?: string },
): Promise<{ encodedInvoice: string; id: string }> {
  if (!stored.spark_mnemonic) throw new Error("No mnemonic on this wallet");
  const w = (await loadSparkWallet(stored.spark_mnemonic, stored.spark_network ?? "MAINNET")) as {
    createLightningInvoice(p: { amountSats: number; memo?: string }): Promise<{
      invoice: { encodedInvoice: string };
      id: string;
    }>;
  };
  const r = await w.createLightningInvoice({ amountSats: opts.amountSats, memo: opts.memo });
  return { encodedInvoice: r.invoice.encodedInvoice, id: r.id };
}

export async function paySparkLightningInvoice(
  stored: StoredWallet,
  opts: { invoice: string; maxFeeSats?: number },
): Promise<{ id: string; preimage?: string }> {
  if (!stored.spark_mnemonic) throw new Error("No mnemonic on this wallet");
  const w = (await loadSparkWallet(stored.spark_mnemonic, stored.spark_network ?? "MAINNET")) as {
    payLightningInvoice(p: { invoice: string; maxFeeSats: number }): Promise<{ id: string }>;
    getLightningSendRequest(id: string): Promise<{ paymentPreimage?: string } | null>;
  };
  const r = await w.payLightningInvoice({
    invoice: opts.invoice,
    maxFeeSats: opts.maxFeeSats ?? 5,
  });
  // Poll for preimage (it's async on Spark — settles on chain via SSP).
  for (let i = 0; i < 10; i++) {
    const state = await w.getLightningSendRequest(r.id);
    if (state?.paymentPreimage) return { id: r.id, preimage: state.paymentPreimage };
    await new Promise((res) => setTimeout(res, 800));
  }
  return { id: r.id };
}

export type WalletTx = {
  id: string;
  direction: "in" | "out";
  amount_msats: number;
  fees_msats?: number;
  description?: string;
  created_at: number;
  state: "settled" | "pending" | "failed";
};

/**
 * Spark transfer history. The SDK's getTransfers shape isn't strongly typed
 * here; we map defensively and skip rows we can't make sense of.
 */
export async function getSparkHistory(stored: StoredWallet, limit = 20): Promise<WalletTx[]> {
  if (!stored.spark_mnemonic) throw new Error("No mnemonic on this wallet");
  const w = (await loadSparkWallet(stored.spark_mnemonic, stored.spark_network ?? "MAINNET")) as {
    getTransfers?: (opts?: { limit?: number; offset?: number }) => Promise<unknown>;
  };
  if (typeof w.getTransfers !== "function") return [];
  const raw = (await w.getTransfers({ limit })) as
    | { transfers?: unknown[] }
    | unknown[]
    | null
    | undefined;
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.transfers) ? raw.transfers : [];
  const txs: WalletTx[] = [];
  for (const t of list) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    const dir =
      (o.transferDirection as string) ??
      (o.direction as string) ??
      (typeof o.totalSent === "number" && o.totalSent > 0 ? "OUTGOING" : "INCOMING");
    const sats =
      (typeof o.totalSent === "number" && o.totalSent > 0
        ? o.totalSent
        : typeof o.totalReceived === "number"
          ? o.totalReceived
          : typeof o.amountSats === "number"
            ? o.amountSats
            : 0) as number;
    const created =
      typeof o.createdAt === "number"
        ? Math.floor(o.createdAt / 1000)
        : typeof o.timestamp === "number"
          ? o.timestamp
          : Date.parse(String(o.createdAt ?? o.timestamp ?? "")) / 1000 || Date.now() / 1000;
    const status = String(o.status ?? "settled").toUpperCase();
    txs.push({
      id: String(o.id ?? o.lightningId ?? o.transferId ?? Math.random().toString(36).slice(2)),
      direction: dir.toUpperCase().includes("OUT") || dir.toUpperCase() === "SEND" ? "out" : "in",
      amount_msats: Math.round(sats * 1000),
      description: typeof o.memo === "string" ? o.memo : typeof o.description === "string" ? o.description : undefined,
      created_at: Math.floor(created),
      state:
        status.includes("FAIL")
          ? "failed"
          : status.includes("PEND") || status.includes("INIT")
            ? "pending"
            : "settled",
    });
  }
  return txs;
}

/**
 * Pick three random word positions for a backup-confirmation challenge.
 * The user has to type back those exact words.
 */
export function pickConfirmIndices(mnemonicLength: number, count = 3): number[] {
  const indices: number[] = [];
  while (indices.length < count) {
    const i = Math.floor(Math.random() * mnemonicLength);
    if (!indices.includes(i)) indices.push(i);
  }
  return indices.sort((a, b) => a - b);
}

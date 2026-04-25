import crypto from "node:crypto";
import { NWCClient } from "@getalby/sdk";

const MOCK_MODE = process.env.TOLLGATE_MOCK_LIGHTNING === "1";

// In Next.js dev, module-level singletons can get stale because the WebSocket
// connection underlying NWC may be dropped between request handlers. We cache
// on globalThis so HMR doesn't blow it away, and we recover on connection error.
declare global {
  // eslint-disable-next-line no-var
  var __tollgatePublisherWallet: NWCClient | undefined;
  // eslint-disable-next-line no-var
  var __tollgateSettledHashes: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __tollgateNotifSubscribed: boolean | undefined;
  // eslint-disable-next-line no-var
  var __tollgateMockInvoices: Map<string, { amount_msats: number; settled: boolean }> | undefined;
}

function newClient(): NWCClient {
  const url = process.env.PUBLISHER_NWC_URL;
  if (!url) throw new Error("PUBLISHER_NWC_URL is not set — cannot create invoices");
  return new NWCClient({ nostrWalletConnectUrl: url });
}

function getClient(): NWCClient {
  if (!globalThis.__tollgatePublisherWallet) {
    globalThis.__tollgatePublisherWallet = newClient();
  }
  return globalThis.__tollgatePublisherWallet;
}

function getSettledSet(): Set<string> {
  if (!globalThis.__tollgateSettledHashes) {
    globalThis.__tollgateSettledHashes = new Set();
  }
  return globalThis.__tollgateSettledHashes;
}

/**
 * Subscribe to incoming-payment notifications once. Each settled payment
 * has its payment_hash added to the in-memory set, so the action route's
 * verify path is just a Set.has() check — no per-request NWC roundtrip.
 */
function ensureNotifSubscription() {
  if (globalThis.__tollgateNotifSubscribed) return;
  globalThis.__tollgateNotifSubscribed = true;
  const wallet = getClient();
  // @getalby/sdk exposes subscribeNotifications(callback, types?)
  wallet
    .subscribeNotifications(
      (notification) => {
        const n = notification as {
          notification_type?: string;
          notification?: { payment_hash?: string; state?: string };
        };
        if (n.notification_type === "payment_received" && n.notification?.payment_hash) {
          getSettledSet().add(n.notification.payment_hash.toLowerCase());
        }
      },
      ["payment_received"],
    )
    .catch((e: unknown) => {
      // If subscribe fails (e.g. wallet doesn't support notifications), we silently
      // fall back to per-request lookupInvoice. Reset the flag so a future call retries.
      process.stderr.write(
        `nwc subscribeNotifications failed: ${e instanceof Error ? e.message : String(e)}\n`,
      );
      globalThis.__tollgateNotifSubscribed = false;
    });
}

export type LightningInvoice = {
  invoice: string;
  payment_hash: string;
  amount_msats: number;
  expires_at: number;
};

function getMockInvoices(): Map<string, { amount_msats: number; settled: boolean }> {
  if (!globalThis.__tollgateMockInvoices) {
    globalThis.__tollgateMockInvoices = new Map();
  }
  return globalThis.__tollgateMockInvoices;
}

export async function createInvoice(opts: {
  amountMsats: number;
  description: string;
  expirySeconds?: number;
}): Promise<LightningInvoice> {
  if (MOCK_MODE) {
    const payment_hash = crypto.randomBytes(32).toString("hex");
    // Synthetic-but-shape-correct BOLT11 placeholder. Not a payable invoice;
    // the agent-side mock wallet recognizes the prefix and "pays" it locally.
    const invoice = `lnbcmock${opts.amountMsats}n1${payment_hash.slice(0, 30)}`;
    getMockInvoices().set(payment_hash, { amount_msats: opts.amountMsats, settled: false });
    return {
      invoice,
      payment_hash,
      amount_msats: opts.amountMsats,
      expires_at: Math.floor(Date.now() / 1000) + (opts.expirySeconds ?? 900),
    };
  }

  ensureNotifSubscription();
  const tryOnce = async () => {
    const wallet = getClient();
    return wallet.makeInvoice({
      amount: opts.amountMsats,
      description: opts.description,
      expiry: opts.expirySeconds ?? 900,
    });
  };
  let result;
  try {
    result = await tryOnce();
  } catch (e) {
    globalThis.__tollgatePublisherWallet = undefined;
    process.stderr.write(
      `makeInvoice retry after error: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    result = await tryOnce();
  }
  return {
    invoice: result.invoice,
    payment_hash: result.payment_hash,
    amount_msats: opts.amountMsats,
    expires_at: result.expires_at,
  };
}

/**
 * Mark an invoice as settled (used by the agent-side mock wallet to signal
 * "payment landed" to the same-process publisher in mock mode).
 */
export function mockMarkSettled(paymentHash: string): boolean {
  const m = getMockInvoices();
  const inv = m.get(paymentHash.toLowerCase()) ?? m.get(paymentHash);
  if (!inv) return false;
  inv.settled = true;
  getSettledSet().add(paymentHash.toLowerCase());
  return true;
}

export async function isInvoiceSettled(paymentHash: string): Promise<boolean> {
  const ph = paymentHash.toLowerCase();
  if (getSettledSet().has(ph)) return true;
  if (MOCK_MODE) {
    const m = getMockInvoices();
    const inv = m.get(ph) ?? m.get(paymentHash);
    if (inv?.settled) {
      getSettledSet().add(ph);
      return true;
    }
    return false;
  }
  try {
    const inv = await getClient().lookupInvoice({ payment_hash: ph });
    process.stderr.write(`lookupInvoice ${ph.slice(0, 12)}… → state=${inv.state}\n`);
    if (inv.state === "settled") {
      getSettledSet().add(ph);
      return true;
    }
  } catch (e: unknown) {
    process.stderr.write(`lookupInvoice err: ${e instanceof Error ? e.message : String(e)}\n`);
  }
  return false;
}

export async function lookupInvoice(paymentHash: string) {
  if (MOCK_MODE) {
    const m = getMockInvoices();
    const inv = m.get(paymentHash.toLowerCase()) ?? m.get(paymentHash);
    return {
      state: inv?.settled ? "settled" : "pending",
      payment_hash: paymentHash,
      amount: inv?.amount_msats ?? 0,
    };
  }
  return getClient().lookupInvoice({ payment_hash: paymentHash });
}

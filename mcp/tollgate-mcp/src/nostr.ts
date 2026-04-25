import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  verifyEvent,
  type Event,
  type EventTemplate,
} from "nostr-tools";
import { SimplePool } from "nostr-tools/pool";

/* ----------------------------------------------------------------------- */
/* Constants                                                               */
/* ----------------------------------------------------------------------- */

export const FEEDBACK_KIND = 30402;

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
];

export function getRelays(): string[] {
  const override = process.env.TOLLGATE_NOSTR_RELAYS;
  if (override && override.trim().length > 0) {
    return override
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("ws://") || s.startsWith("wss://"));
  }
  return DEFAULT_RELAYS;
}

/* ----------------------------------------------------------------------- */
/* Agent identity (Nostr keypair)                                          */
/* ----------------------------------------------------------------------- */

let cached: { secretKey: Uint8Array; publicKey: string } | null = null;

function keyPath(): string {
  const dir = process.env.TOLLGATE_DATA_DIR || path.join(os.homedir(), ".tollgate");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "agent_nostr.sk");
}

/**
 * Returns the agent's persistent Nostr keypair, generating + persisting
 * one on first call. Secret key is hex-encoded in the on-disk file.
 */
export function getAgentNostrKey(): { secretKey: Uint8Array; publicKey: string } {
  if (cached) return cached;
  const p = keyPath();
  let secretKey: Uint8Array;
  if (fs.existsSync(p)) {
    const hex = fs.readFileSync(p, "utf8").trim();
    secretKey = Uint8Array.from(Buffer.from(hex, "hex"));
    if (secretKey.length !== 32) {
      throw new Error(`agent_nostr.sk is corrupted (length ${secretKey.length})`);
    }
  } else {
    secretKey = generateSecretKey();
    fs.writeFileSync(p, Buffer.from(secretKey).toString("hex"), { mode: 0o600 });
  }
  const publicKey = getPublicKey(secretKey);
  cached = { secretKey, publicKey };
  return cached;
}

/**
 * Optional: rotate to an ephemeral keypair for privacy-sensitive purchases.
 * Saves to a separate slot so the persistent identity isn't overwritten.
 */
export function generateEphemeralKey(): { secretKey: Uint8Array; publicKey: string } {
  const sk = generateSecretKey();
  return { secretKey: sk, publicKey: getPublicKey(sk) };
}

/* ----------------------------------------------------------------------- */
/* Event construction                                                      */
/* ----------------------------------------------------------------------- */

export type Receipt = {
  receipt_id: string;
  action_id: string;
  amount_msats: number;
  payment_hash: string;
  input_hash: string;
  output_hash: string;
  completed_at: string;
  service_pubkey: string;
  signature: string;
  buyer_pubkey?: string;
};

export type FeedbackEvent = Event & { content: string };

/**
 * Build (but don't sign) a feedback event for the given receipt.
 * Score is clamped to [0, 1].
 */
export function buildFeedbackTemplate(opts: {
  receipt: Receipt;
  domain: string;
  score: number;
  note?: string;
}): EventTemplate {
  const score = Math.max(0, Math.min(1, opts.score));
  const content = JSON.stringify({
    score,
    note: opts.note,
    receipt: opts.receipt, // embedded, signed by service_pubkey
  });
  return {
    kind: FEEDBACK_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      // NIP-01 only indexes single-letter tags. We use:
      //   d → receipt_id (parameterized-replaceable key)
      //   s → service_pubkey hex (the queryable identifier for reputation lookups)
      //   p → buyer_pubkey (so the rater is also indexed for "show me all my ratings")
      ["d", opts.receipt.receipt_id],
      ["s", opts.receipt.service_pubkey],
      ["p", opts.receipt.buyer_pubkey ?? ""],
      // Multi-letter tags below are for human inspection only; not indexable.
      ["domain", opts.domain],
      ["action_id", opts.receipt.action_id],
      ["amount_msats", String(opts.receipt.amount_msats)],
      ["payment_hash", opts.receipt.payment_hash],
      ["score", score.toFixed(4)],
    ],
    content,
  };
}

export function signEvent(template: EventTemplate, secretKey: Uint8Array): Event {
  return finalizeEvent(template, secretKey);
}

/* ----------------------------------------------------------------------- */
/* Publishing                                                              */
/* ----------------------------------------------------------------------- */

let _pool: SimplePool | null = null;
function pool(): SimplePool {
  if (!_pool) _pool = new SimplePool();
  return _pool;
}

export async function publishToRelays(
  event: Event,
  relays: string[] = getRelays(),
): Promise<{ accepted: string[]; rejected: Array<{ relay: string; reason: string }> }> {
  const accepted: string[] = [];
  const rejected: Array<{ relay: string; reason: string }> = [];
  const promises = pool().publish(relays, event);
  await Promise.allSettled(
    promises.map((p, i) =>
      p
        .then(() => {
          accepted.push(relays[i]);
        })
        .catch((e: unknown) => {
          rejected.push({
            relay: relays[i],
            reason: e instanceof Error ? e.message : String(e),
          });
        }),
    ),
  );
  return { accepted, rejected };
}

/* ----------------------------------------------------------------------- */
/* Querying + verification                                                 */
/* ----------------------------------------------------------------------- */

export async function fetchFeedbackEvents(opts: {
  servicePubkeyHex: string;
  relays?: string[];
  limit?: number;
  sinceUnixSeconds?: number;
  timeoutMs?: number;
}): Promise<Event[]> {
  const relays = opts.relays ?? getRelays();
  const limit = opts.limit ?? 500;
  const filter = {
    kinds: [FEEDBACK_KIND],
    "#s": [opts.servicePubkeyHex],
    limit,
    ...(opts.sinceUnixSeconds ? { since: opts.sinceUnixSeconds } : {}),
  };
  const events: Event[] = [];
  const seen = new Set<string>();
  await new Promise<void>((resolve) => {
    const sub = pool().subscribe(relays, filter, {
      onevent(e: Event) {
        if (!seen.has(e.id)) {
          seen.add(e.id);
          events.push(e);
        }
      },
      oneose() {
        sub.close();
        resolve();
      },
    });
    setTimeout(() => {
      sub.close();
      resolve();
    }, opts.timeoutMs ?? 4000);
  });
  return events;
}

export type VerifiedFeedback = {
  event_id: string;
  rater_pubkey: string;
  receipt_id: string;
  service_pubkey: string;
  domain: string;
  action_id: string;
  amount_msats: number;
  score: number;
  note?: string;
  created_at: number;
};

/**
 * Validate a feedback event:
 *   1. Nostr event signature
 *   2. content parses, contains a receipt
 *   3. receipt.signature is a valid Ed25519 signature against receipt.service_pubkey
 *   4. receipt.buyer_pubkey === event.pubkey  (rater paid for this action)
 *   5. Tag/content consistency
 *
 * Returns the trusted projection on success, null on any failure.
 */
import crypto from "node:crypto";

function canonicalReceiptCore(r: Receipt): string {
  // Sort keys alphabetically; exclude `signature`. Mirrors keys.ts on the publisher.
  const keys: (keyof Receipt)[] = [
    "action_id",
    "amount_msats",
    "buyer_pubkey",
    "completed_at",
    "input_hash",
    "output_hash",
    "payment_hash",
    "receipt_id",
    "service_pubkey",
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (r[k] !== undefined) out[k] = r[k];
  }
  return JSON.stringify(out, Object.keys(out).sort());
}

export function verifyFeedbackEvent(e: Event): VerifiedFeedback | null {
  try {
    if (!verifyEvent(e)) return null;
    if (e.kind !== FEEDBACK_KIND) return null;
    const parsed = JSON.parse(e.content) as {
      score?: number;
      note?: string;
      receipt?: Receipt;
    };
    if (typeof parsed.score !== "number") return null;
    if (parsed.score < 0 || parsed.score > 1) return null;
    const r = parsed.receipt;
    if (!r) return null;
    // The rater must be the buyer.
    if (r.buyer_pubkey !== e.pubkey) return null;
    // Verify the publisher's signature on the receipt.
    const core = canonicalReceiptCore(r);
    let pub;
    try {
      pub = crypto.createPublicKey({
        key: Buffer.from(r.service_pubkey, "hex"),
        format: "der",
        type: "spki",
      });
    } catch {
      return null;
    }
    const sigOk = crypto.verify(
      null,
      Buffer.from(core),
      pub,
      Buffer.from(r.signature, "hex"),
    );
    if (!sigOk) return null;

    // Tag/receipt consistency.
    const tagD = e.tags.find((t) => t[0] === "d")?.[1];
    if (tagD !== r.receipt_id) return null;
    const tagSvc = e.tags.find((t) => t[0] === "s")?.[1];
    if (tagSvc !== r.service_pubkey) return null;
    const domain = e.tags.find((t) => t[0] === "domain")?.[1];
    if (!domain) return null;

    return {
      event_id: e.id,
      rater_pubkey: e.pubkey,
      receipt_id: r.receipt_id,
      service_pubkey: r.service_pubkey,
      domain,
      action_id: r.action_id,
      amount_msats: r.amount_msats,
      score: parsed.score,
      note: parsed.note,
      created_at: e.created_at,
    };
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------------- */
/* Aggregation                                                             */
/* ----------------------------------------------------------------------- */

export type ReputationSummary = {
  service_pubkey: string;
  domain: string;
  weighted_score: number; // Σ(amount × score) / Σ(amount), or NaN if no data
  flat_average: number; // Σ(score) / N, simple mean
  sample_size: number;
  total_msats: number;
  unique_raters: number;
  last_event_at: number; // unix seconds
  per_action: Array<{
    action_id: string;
    sample_size: number;
    weighted_score: number;
  }>;
};

/**
 * For replaceable kind 30402: when the same (rater_pubkey, receipt_id) pair
 * appears multiple times, only the most recent created_at counts. nostr-tools
 * already deduplicates by event id, but raters may publish replacements.
 */
function dedupReplaceable(items: VerifiedFeedback[]): VerifiedFeedback[] {
  const latest = new Map<string, VerifiedFeedback>();
  for (const f of items) {
    const key = `${f.rater_pubkey}/${f.receipt_id}`;
    const prev = latest.get(key);
    if (!prev || f.created_at > prev.created_at) latest.set(key, f);
  }
  return [...latest.values()];
}

export function aggregateReputation(
  feedbacks: VerifiedFeedback[],
  opts: { service_pubkey: string; domain: string },
): ReputationSummary {
  const items = dedupReplaceable(feedbacks);
  const totalMsats = items.reduce((acc, f) => acc + f.amount_msats, 0);
  const weightedSum = items.reduce((acc, f) => acc + f.amount_msats * f.score, 0);
  const flatSum = items.reduce((acc, f) => acc + f.score, 0);
  const raters = new Set(items.map((f) => f.rater_pubkey));
  const last = items.reduce((m, f) => Math.max(m, f.created_at), 0);

  const perAction = new Map<
    string,
    { sample: number; weighted: number; total: number }
  >();
  for (const f of items) {
    const cur = perAction.get(f.action_id) ?? { sample: 0, weighted: 0, total: 0 };
    cur.sample++;
    cur.weighted += f.amount_msats * f.score;
    cur.total += f.amount_msats;
    perAction.set(f.action_id, cur);
  }

  return {
    service_pubkey: opts.service_pubkey,
    domain: opts.domain,
    weighted_score: totalMsats > 0 ? weightedSum / totalMsats : NaN,
    flat_average: items.length > 0 ? flatSum / items.length : NaN,
    sample_size: items.length,
    total_msats: totalMsats,
    unique_raters: raters.size,
    last_event_at: last,
    per_action: [...perAction.entries()].map(([action_id, v]) => ({
      action_id,
      sample_size: v.sample,
      weighted_score: v.total > 0 ? v.weighted / v.total : NaN,
    })),
  };
}

/* ----------------------------------------------------------------------- */
/* Cleanup                                                                 */
/* ----------------------------------------------------------------------- */

export function closePool(): void {
  if (_pool) {
    try {
      _pool.close(getRelays());
    } catch {}
    _pool = null;
  }
}

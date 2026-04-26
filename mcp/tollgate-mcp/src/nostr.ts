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
/* Per-rater diversity                                                     */
/* ----------------------------------------------------------------------- */

/**
 * Fetch a rater's full kind-30402 history across relays and count how many
 * distinct services they've rated. Used to compute rater trust weights.
 *
 * Returns null if the lookup fails (relay timeout, etc.) so callers can fall
 * back to a "default weight" rather than dropping the rater entirely.
 */
export async function fetchRaterHistory(opts: {
  raterPubkey: string;
  relays?: string[];
  timeoutMs?: number;
}): Promise<{ distinct_services: number; total_ratings: number } | null> {
  const relays = opts.relays ?? getRelays();
  const filter = {
    kinds: [FEEDBACK_KIND],
    authors: [opts.raterPubkey],
    limit: 1000,
  };
  const events: Event[] = [];
  const seen = new Set<string>();
  let resolved = false;
  await new Promise<void>((resolve) => {
    const finish = () => {
      if (!resolved) {
        resolved = true;
        try {
          sub.close();
        } catch {}
        resolve();
      }
    };
    const sub = pool().subscribe(relays, filter, {
      onevent(e: Event) {
        if (!seen.has(e.id)) {
          seen.add(e.id);
          events.push(e);
        }
      },
      oneose: finish,
    });
    setTimeout(finish, opts.timeoutMs ?? 4000);
  });
  if (events.length === 0) {
    // Could be no history, or could be relay miss. Caller decides interpretation.
    return { distinct_services: 0, total_ratings: 0 };
  }
  const services = new Set<string>();
  // Per replaceable-event semantics, a single (pubkey, d) pair counts once.
  const seenReplaceable = new Set<string>();
  for (const e of events) {
    const d = e.tags.find((t) => t[0] === "d")?.[1];
    const s = e.tags.find((t) => t[0] === "s")?.[1];
    if (!s) continue;
    const key = `${e.pubkey}/${d ?? ""}`;
    if (seenReplaceable.has(key)) continue;
    seenReplaceable.add(key);
    services.add(s);
  }
  return { distinct_services: services.size, total_ratings: seenReplaceable.size };
}

/**
 * Compute a 0–1 weight for a rater based on how many distinct services they've
 * rated. Pure function of (distinct_services, knobs).
 *
 *   weight = clamp01( (distinct - min_to_count + 1) / (full_at - min_to_count + 1) )
 *
 * Defaults: min_to_count = 1, full_at = 3
 *   distinct = 1 → 1/3 ≈ 0.33
 *   distinct = 2 → 2/3 ≈ 0.67
 *   distinct = 3 → 1.0
 *
 * If min_to_count = 3 and full_at = 3:
 *   distinct < 3 → 0 (drop entirely)
 *   distinct ≥ 3 → 1.0
 */
export function diversityWeight(opts: {
  distinct_services: number;
  min_to_count?: number;
  full_at?: number;
}): number {
  const min = Math.max(1, opts.min_to_count ?? 1);
  const full = Math.max(min, opts.full_at ?? 3);
  if (opts.distinct_services < min) return 0;
  if (full === min) return 1;
  const x = (opts.distinct_services - min + 1) / (full - min + 1);
  return Math.max(0, Math.min(1, x));
}

/* ----------------------------------------------------------------------- */
/* Aggregation                                                             */
/* ----------------------------------------------------------------------- */

export type RaterContribution = {
  rater_pubkey: string;
  distinct_services: number;
  diversity_weight: number;
  rated_count_for_this_service: number;
  total_amount_msats: number;
};

export type ReputationSummary = {
  service_pubkey: string;
  domain: string;
  /**
   * The canonical reputation score:
   *   Σ(amount × score × diversity_weight) / Σ(amount × diversity_weight)
   * Single-service raters are downweighted; multi-service raters carry full weight.
   */
  weighted_score: number;
  /**
   * The raw amount-weighted average without diversity weighting, for comparison.
   *   Σ(amount × score) / Σ(amount)
   */
  unweighted_score: number;
  flat_average: number;
  sample_size: number;
  effective_sample_size: number; // sample weighted by diversity_weight
  total_msats: number;
  effective_msats: number; // total_msats weighted by diversity_weight
  unique_raters: number;
  trusted_unique_raters: number; // raters with diversity_weight ≥ 0.5
  last_event_at: number;
  per_action: Array<{
    action_id: string;
    sample_size: number;
    weighted_score: number;
  }>;
  raters: RaterContribution[];
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
  opts: {
    service_pubkey: string;
    domain: string;
    /**
     * Map from rater_pubkey → distinct_services count. Missing raters get
     * `defaultDistinctServices` (defaults to 1 — minimal trust).
     */
    raterDistinctServices?: Record<string, number>;
    defaultDistinctServices?: number;
    minDistinctServicesToCount?: number;
    fullWeightAtDistinctServices?: number;
  },
): ReputationSummary {
  const items = dedupReplaceable(feedbacks);
  const last = items.reduce((m, f) => Math.max(m, f.created_at), 0);

  const ratersMap = opts.raterDistinctServices ?? {};
  const defaultN = opts.defaultDistinctServices ?? 1;
  const minToCount = opts.minDistinctServicesToCount ?? 1;
  const fullAt = opts.fullWeightAtDistinctServices ?? 3;

  // Aggregate per-rater contributions for the summary's `raters` field and
  // for computing the diversity-weighted score.
  type RaterAgg = {
    distinct: number;
    weight: number;
    rated: number;
    total_msats: number;
  };
  const perRater = new Map<string, RaterAgg>();
  for (const f of items) {
    let agg = perRater.get(f.rater_pubkey);
    if (!agg) {
      const distinct = ratersMap[f.rater_pubkey] ?? defaultN;
      const weight = diversityWeight({
        distinct_services: distinct,
        min_to_count: minToCount,
        full_at: fullAt,
      });
      agg = { distinct, weight, rated: 0, total_msats: 0 };
      perRater.set(f.rater_pubkey, agg);
    }
    agg.rated++;
    agg.total_msats += f.amount_msats;
  }

  let weightedSumDiverse = 0; // Σ(amount × score × weight)
  let totalMsatsDiverse = 0; // Σ(amount × weight)
  let weightedSumRaw = 0; // Σ(amount × score)
  let totalMsatsRaw = 0; // Σ(amount)
  let flatSum = 0;
  let effectiveSample = 0; // Σ(weight)
  let trustedRaters = 0;
  for (const f of items) {
    const w = perRater.get(f.rater_pubkey)?.weight ?? 0;
    weightedSumDiverse += f.amount_msats * f.score * w;
    totalMsatsDiverse += f.amount_msats * w;
    weightedSumRaw += f.amount_msats * f.score;
    totalMsatsRaw += f.amount_msats;
    flatSum += f.score;
    effectiveSample += w;
  }
  for (const r of perRater.values()) {
    if (r.weight >= 0.5) trustedRaters++;
  }

  const perAction = new Map<
    string,
    { sample: number; weighted: number; total: number }
  >();
  for (const f of items) {
    const w = perRater.get(f.rater_pubkey)?.weight ?? 0;
    const cur = perAction.get(f.action_id) ?? { sample: 0, weighted: 0, total: 0 };
    cur.sample++;
    cur.weighted += f.amount_msats * f.score * w;
    cur.total += f.amount_msats * w;
    perAction.set(f.action_id, cur);
  }

  const raters: RaterContribution[] = [...perRater.entries()].map(
    ([pubkey, agg]) => ({
      rater_pubkey: pubkey,
      distinct_services: agg.distinct,
      diversity_weight: Number(agg.weight.toFixed(4)),
      rated_count_for_this_service: agg.rated,
      total_amount_msats: agg.total_msats,
    }),
  );
  raters.sort((a, b) => b.total_amount_msats - a.total_amount_msats);

  return {
    service_pubkey: opts.service_pubkey,
    domain: opts.domain,
    weighted_score: totalMsatsDiverse > 0 ? weightedSumDiverse / totalMsatsDiverse : NaN,
    unweighted_score: totalMsatsRaw > 0 ? weightedSumRaw / totalMsatsRaw : NaN,
    flat_average: items.length > 0 ? flatSum / items.length : NaN,
    sample_size: items.length,
    effective_sample_size: Number(effectiveSample.toFixed(4)),
    total_msats: totalMsatsRaw,
    effective_msats: Math.round(totalMsatsDiverse),
    unique_raters: perRater.size,
    trusted_unique_raters: trustedRaters,
    last_event_at: last,
    per_action: [...perAction.entries()].map(([action_id, v]) => ({
      action_id,
      sample_size: v.sample,
      weighted_score: v.total > 0 ? v.weighted / v.total : NaN,
    })),
    raters,
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

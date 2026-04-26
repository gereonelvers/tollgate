// Anti-Sybil weighting unit test.
// Constructs feedback events from two raters:
//   - "diverse": has rated 5 services → full weight
//   - "single":  has only rated this service → downweighted
// Asserts the diversity-weighted score correctly downweights the single-target rater.

import crypto from "node:crypto";
import {
  buildFeedbackTemplate,
  signEvent,
  verifyFeedbackEvent,
  aggregateReputation,
  diversityWeight,
  type Receipt,
} from "./nostr.js";
import { generateSecretKey, getPublicKey } from "nostr-tools";

const log = (...m: unknown[]) =>
  process.stdout.write(m.map((x) => (typeof x === "string" ? x : JSON.stringify(x, null, 2))).join(" ") + "\n");

const svc = crypto.generateKeyPairSync("ed25519");
const svcPubkeyHex = crypto
  .createPublicKey(svc.privateKey)
  .export({ format: "der", type: "spki" })
  .toString("hex");

const CORE_KEYS = [
  "action_id", "amount_msats", "buyer_pubkey", "completed_at",
  "input_hash", "output_hash", "payment_hash", "receipt_id", "service_pubkey",
] as const;
function makeReceipt(buyer_pubkey: string, amount_msats: number, idx: number): Receipt {
  const core = {
    action_id: "ask.site_agent",
    amount_msats,
    buyer_pubkey,
    completed_at: new Date().toISOString(),
    input_hash: crypto.randomBytes(32).toString("hex"),
    output_hash: crypto.randomBytes(32).toString("hex"),
    payment_hash: crypto.randomBytes(32).toString("hex"),
    receipt_id: `rcpt_test_${idx}_${Date.now()}`,
    service_pubkey: svcPubkeyHex,
  };
  const present = (CORE_KEYS as readonly string[]).filter((k) => (core as Record<string, unknown>)[k] !== undefined);
  const canonical = JSON.stringify(core, present);
  const sig = crypto.sign(null, Buffer.from(canonical), svc.privateKey).toString("hex");
  return { ...core, signature: sig };
}

// Two raters
const diverseSk = generateSecretKey();
const diversePk = getPublicKey(diverseSk);
const singleSk = generateSecretKey();
const singlePk = getPublicKey(singleSk);

// Both rate this service for 1000 msats with score 0.9 and 0.4 respectively.
const diverseReceipt = makeReceipt(diversePk, 1000, 1);
const singleReceipt = makeReceipt(singlePk, 1000, 2);

const diverseEvt = signEvent(
  buildFeedbackTemplate({ receipt: diverseReceipt, domain: "test.example", score: 0.9 }),
  diverseSk,
);
const singleEvt = signEvent(
  buildFeedbackTemplate({ receipt: singleReceipt, domain: "test.example", score: 0.4 }),
  singleSk,
);

const verified = [diverseEvt, singleEvt]
  .map(verifyFeedbackEvent)
  .filter((v): v is NonNullable<typeof v> => v !== null);

if (verified.length !== 2) {
  log(`FAIL: expected 2 verified events, got ${verified.length}`);
  process.exit(1);
}

// ---------- assertion 1: diversityWeight is monotonic ----------
const weights = [1, 2, 3, 4, 5].map((n) => ({
  n,
  w: diversityWeight({ distinct_services: n, min_to_count: 1, full_at: 3 }),
}));
log("[1] diversityWeight curve (min=1, full=3):", weights);
if (weights[0].w !== 1 / 3) { log(`FAIL: w(1) expected 0.333, got ${weights[0].w}`); process.exit(1); }
if (weights[1].w !== 2 / 3) { log(`FAIL: w(2) expected 0.667, got ${weights[1].w}`); process.exit(1); }
if (weights[2].w !== 1) { log(`FAIL: w(3) expected 1.0, got ${weights[2].w}`); process.exit(1); }
if (weights[3].w !== 1) { log(`FAIL: w(4) expected 1.0, got ${weights[3].w}`); process.exit(1); }

// ---------- assertion 2: aggregation with no diversity data falls back to default ----------
const noDiversity = aggregateReputation(verified, {
  service_pubkey: svcPubkeyHex,
  domain: "test.example",
});
log("\n[2] no diversity data — both raters get default weight 0.333:");
log({
  weighted_score: noDiversity.weighted_score,
  unweighted_score: noDiversity.unweighted_score,
  effective_sample: noDiversity.effective_sample_size,
  raters: noDiversity.raters.map((r) => ({ p: r.rater_pubkey.slice(0, 8), w: r.diversity_weight })),
});
// Both raters get weight 1/3, so weighted == unweighted
const expectedRaw = (1000 * 0.9 + 1000 * 0.4) / 2000;
if (Math.abs(noDiversity.unweighted_score - expectedRaw) > 1e-9) {
  log(`FAIL: unweighted_score=${noDiversity.unweighted_score}, expected ${expectedRaw}`);
  process.exit(1);
}

// ---------- assertion 3: with proper diversity data the single-target rater is downweighted ----------
const diversityMap = {
  [diversePk]: 5, // diverse rater — full weight
  [singlePk]: 1, // single-target — downweight to 0.333
};
const weighted = aggregateReputation(verified, {
  service_pubkey: svcPubkeyHex,
  domain: "test.example",
  raterDistinctServices: diversityMap,
  minDistinctServicesToCount: 1,
  fullWeightAtDistinctServices: 3,
});
log("\n[3] diversity-weighted aggregation:");
log({
  weighted_score: weighted.weighted_score,
  unweighted_score: weighted.unweighted_score,
  effective_sample: weighted.effective_sample_size,
  trusted_raters: weighted.trusted_unique_raters,
  raters: weighted.raters.map((r) => ({
    p: r.rater_pubkey.slice(0, 8),
    distinct: r.distinct_services,
    weight: r.diversity_weight,
  })),
});

// Math: diverse contributes 1000 * 0.9 * 1.0 = 900 over 1000 weight
//       single  contributes 1000 * 0.4 * (1/3) = 133.33 over 333.33 weight
//       weighted = (900 + 133.33) / (1000 + 333.33) = 1033.33 / 1333.33 = 0.775
const expectedWeighted = (1000 * 0.9 * 1 + 1000 * 0.4 * (1 / 3)) / (1000 * 1 + 1000 * (1 / 3));
if (Math.abs(weighted.weighted_score - expectedWeighted) > 1e-6) {
  log(`FAIL: weighted_score=${weighted.weighted_score}, expected ${expectedWeighted}`);
  process.exit(1);
}
log(`[3] math correct: ${weighted.weighted_score.toFixed(6)} == ${expectedWeighted.toFixed(6)} ✓`);

// Confirm the score is meaningfully closer to the diverse rater's 0.9 than the unweighted 0.65.
if (!(weighted.weighted_score > weighted.unweighted_score)) {
  log(`FAIL: expected weighted (${weighted.weighted_score}) > unweighted (${weighted.unweighted_score})`);
  process.exit(1);
}
log(`[3] downweighted attack ✓: weighted ${weighted.weighted_score.toFixed(3)} > unweighted ${weighted.unweighted_score.toFixed(3)}`);

// ---------- assertion 4: strict mode (min=3) drops the single-target rater entirely ----------
const strict = aggregateReputation(verified, {
  service_pubkey: svcPubkeyHex,
  domain: "test.example",
  raterDistinctServices: diversityMap,
  minDistinctServicesToCount: 3,
  fullWeightAtDistinctServices: 3,
});
log("\n[4] strict mode (min_to_count = 3):");
log({
  weighted_score: strict.weighted_score,
  effective_sample: strict.effective_sample_size,
});
// Only the diverse rater counts; weighted score should equal their score 0.9
if (Math.abs(strict.weighted_score - 0.9) > 1e-9) {
  log(`FAIL: strict weighted=${strict.weighted_score}, expected 0.9`);
  process.exit(1);
}
log(`[4] single-target rater dropped ✓; weighted = 0.9 (diverse only)`);

log("\nALL PASS ✓");
process.exit(0);

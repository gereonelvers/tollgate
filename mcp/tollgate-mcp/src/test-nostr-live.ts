// Live round-trip against real Nostr relays.
// 1) Build a synthetic receipt signed by a test publisher key
// 2) Publish a feedback event tied to it
// 3) Subscribe + fetch the event back
// 4) Verify the chain end-to-end
//
// No Lightning required. Exercises the full Nostr publish + verify path on production relays.

import crypto from "node:crypto";
import {
  buildFeedbackTemplate,
  signEvent,
  verifyFeedbackEvent,
  publishToRelays,
  fetchFeedbackEvents,
  aggregateReputation,
  closePool,
  getRelays,
  type Receipt,
} from "./nostr.js";
import { generateSecretKey, getPublicKey } from "nostr-tools";

const log = (...m: unknown[]) =>
  process.stdout.write(m.map((x) => (typeof x === "string" ? x : JSON.stringify(x, null, 2))).join(" ") + "\n");

// ---------------------------------------------------------------
// step 1: synthetic publisher + receipt
// ---------------------------------------------------------------
const svcKp = crypto.generateKeyPairSync("ed25519");
const svcPubkeyHex = crypto
  .createPublicKey(svcKp.privateKey)
  .export({ format: "der", type: "spki" })
  .toString("hex");

// One-shot ephemeral rater so we don't pollute a persistent identity.
const raterSk = generateSecretKey();
const raterPk = getPublicKey(raterSk);

const baseCore = {
  action_id: "ask.site_agent",
  amount_msats: 3000,
  buyer_pubkey: raterPk,
  completed_at: new Date().toISOString(),
  input_hash: "a".repeat(64),
  output_hash: "b".repeat(64),
  payment_hash: crypto.randomBytes(32).toString("hex"),
  receipt_id: `rcpt_live_${Date.now()}`,
  service_pubkey: svcPubkeyHex,
};
const CORE_KEYS: (keyof typeof baseCore)[] = [
  "action_id", "amount_msats", "buyer_pubkey", "completed_at",
  "input_hash", "output_hash", "payment_hash", "receipt_id", "service_pubkey",
];
function signReceipt(core: typeof baseCore): Receipt {
  const present = CORE_KEYS.filter((k) => core[k] !== undefined);
  const canonical = JSON.stringify(core, present);
  const sig = crypto.sign(null, Buffer.from(canonical), svcKp.privateKey).toString("hex");
  return { ...core, signature: sig };
}
const receipt = signReceipt(baseCore);

log(`[setup] synthetic publisher pubkey: ${svcPubkeyHex.slice(0, 24)}…`);
log(`[setup] ephemeral rater pubkey:    ${raterPk.slice(0, 24)}…`);
log(`[setup] receipt: ${receipt.receipt_id} for ${receipt.amount_msats} msats`);
log(`[setup] relays: ${getRelays().join(", ")}`);

// ---------------------------------------------------------------
// step 2: build + sign + publish
// ---------------------------------------------------------------
log("\n[publish] signing feedback event with score=0.92…");
const tmpl = buildFeedbackTemplate({ receipt, domain: "live-test.example", score: 0.92 });
const evt = signEvent(tmpl, raterSk);
log(`[publish] event id: ${evt.id}`);

const t0 = Date.now();
const { accepted, rejected } = await publishToRelays(evt);
log(`[publish] in ${Date.now() - t0}ms`);
log(`[publish] accepted by ${accepted.length} relay(s):`);
for (const r of accepted) log(`            ✓ ${r}`);
if (rejected.length > 0) {
  log(`[publish] rejected by ${rejected.length}:`);
  for (const r of rejected) log(`            ✗ ${r.relay} — ${r.reason}`);
}
if (accepted.length === 0) {
  log("\nFAIL: no relays accepted the event");
  closePool();
  process.exit(1);
}

// Give relays a moment to propagate within their replication graph.
log("\n[settle] waiting 1.5s for relay-side propagation…");
await new Promise((r) => setTimeout(r, 1500));

// ---------------------------------------------------------------
// step 3: fetch back
// ---------------------------------------------------------------
log("[fetch] querying relays for feedback events with our service_pubkey tag…");
const t1 = Date.now();
const events = await fetchFeedbackEvents({
  servicePubkeyHex: svcPubkeyHex,
  timeoutMs: 6000,
});
log(`[fetch] in ${Date.now() - t1}ms — got ${events.length} raw event(s)`);

const found = events.find((e) => e.id === evt.id);
if (!found) {
  log(`\nFAIL: published event ${evt.id} not found in fetched results`);
  log("(this can happen if relays are slow to propagate; try again in a few seconds)");
  closePool();
  process.exit(1);
}
log(`[fetch] ✓ found our event in fetched set`);

// ---------------------------------------------------------------
// step 4: end-to-end verify + aggregate
// ---------------------------------------------------------------
const verified = events
  .map(verifyFeedbackEvent)
  .filter((v): v is NonNullable<typeof v> => v !== null);
log(`[verify] ${verified.length} of ${events.length} events passed full chain verification`);

const ours = verified.find((v) => v.event_id === evt.id);
if (!ours) {
  log("\nFAIL: our event didn't pass verification");
  closePool();
  process.exit(1);
}
log(`[verify] ✓ our event passed: rater matches buyer ✓, receipt sig valid ✓, tags consistent ✓`);

const summary = aggregateReputation(verified, {
  service_pubkey: svcPubkeyHex,
  domain: "live-test.example",
});
log("\n[aggregate]");
log(summary);

if (summary.weighted_score !== 0.92) {
  log(`\nFAIL: weighted_score=${summary.weighted_score}, expected 0.92`);
  closePool();
  process.exit(1);
}

log(
  `\n========================================` +
  `\n  LIVE NOSTR ROUND-TRIP VERIFIED ✓` +
  `\n  publish → propagate → fetch → verify` +
  `\n  weighted_score = ${summary.weighted_score} (matches input)` +
  `\n========================================\n`,
);

closePool();
process.exit(0);

// Quick local roundtrip test: build a fake receipt, build+sign a feedback event,
// verify it, aggregate, and assert the math. No network calls.

import crypto from "node:crypto";
import {
  getAgentNostrKey,
  buildFeedbackTemplate,
  signEvent,
  verifyFeedbackEvent,
  aggregateReputation,
  type Receipt,
} from "./nostr.js";

// Generate a publisher service keypair, sign a fake receipt the same way the publisher does.
const svc = crypto.generateKeyPairSync("ed25519");
const svcPubkeyHex = crypto
  .createPublicKey(svc.privateKey)
  .export({ format: "der", type: "spki" })
  .toString("hex");

const agent = getAgentNostrKey();

const receiptCore = {
  action_id: "ask.site_agent",
  amount_msats: 3000,
  buyer_pubkey: agent.publicKey,
  completed_at: new Date().toISOString(),
  input_hash: "a".repeat(64),
  output_hash: "b".repeat(64),
  payment_hash: "c".repeat(64),
  receipt_id: "rcpt_test_001",
  service_pubkey: svcPubkeyHex,
};
const CORE_KEYS: (keyof typeof receiptCore)[] = [
  "action_id", "amount_msats", "buyer_pubkey", "completed_at",
  "input_hash", "output_hash", "payment_hash", "receipt_id", "service_pubkey",
];
const present = CORE_KEYS.filter((k) => receiptCore[k] !== undefined);
const canonical = JSON.stringify(receiptCore, present);
const signature = crypto.sign(null, Buffer.from(canonical), svc.privateKey).toString("hex");
const receipt: Receipt = { ...receiptCore, signature };

console.log("[1] receipt signed; service_pubkey:", svcPubkeyHex.slice(0, 24) + "…");
console.log("[2] agent Nostr pubkey:", agent.publicKey.slice(0, 24) + "…");

// Build + sign feedback event with score 0.92
const tmpl = buildFeedbackTemplate({
  receipt,
  domain: "example.com",
  score: 0.92,
});
const evt = signEvent(tmpl, agent.secretKey);
console.log("[3] feedback event signed; id:", evt.id.slice(0, 16) + "…");

// Verify
const ok = verifyFeedbackEvent(evt);
if (!ok) {
  console.error("FAIL: verifyFeedbackEvent returned null");
  process.exit(1);
}
console.log("[4] verification ok; rater matches buyer ✓; receipt sig valid ✓");

// Aggregate with two events at different prices/scores
const tmpl2 = buildFeedbackTemplate({
  receipt: { ...receipt, receipt_id: "rcpt_test_002", amount_msats: 1000 },
  domain: "example.com",
  score: 0.5,
});
// Need to re-sign with same agent key but a DIFFERENT receipt fully signed by service
const receipt2Core = { ...receiptCore, receipt_id: "rcpt_test_002", amount_msats: 1000 };
const r2present = CORE_KEYS.filter((k) => receipt2Core[k] !== undefined);
const r2canon = JSON.stringify(receipt2Core, r2present);
const r2sig = crypto.sign(null, Buffer.from(r2canon), svc.privateKey).toString("hex");
const receipt2: Receipt = { ...receipt2Core, signature: r2sig };
const tmpl2real = buildFeedbackTemplate({ receipt: receipt2, domain: "example.com", score: 0.5 });
const evt2 = signEvent(tmpl2real, agent.secretKey);
const ok2 = verifyFeedbackEvent(evt2);
if (!ok2) {
  console.error("FAIL: second event verification failed");
  process.exit(1);
}

const summary = aggregateReputation([ok, ok2], {
  service_pubkey: svcPubkeyHex,
  domain: "example.com",
});
console.log("[5] aggregate:", summary);

// Math check: weighted = (3000*0.92 + 1000*0.5) / 4000 = (2760 + 500)/4000 = 0.815
const expected = (3000 * 0.92 + 1000 * 0.5) / 4000;
const diff = Math.abs(summary.weighted_score - expected);
if (diff > 1e-9) {
  console.error(`FAIL: weighted_score=${summary.weighted_score} expected ${expected}`);
  process.exit(1);
}
console.log("[6] weighted score correct:", summary.weighted_score, "==", expected);

// Negative test: tamper with the score and re-sign — verification should still pass for the
// inner content, but tampering the receipt should fail. Tamper amount_msats:
const tampered: Receipt = { ...receipt, amount_msats: 999999 };
const tamperedTmpl = buildFeedbackTemplate({ receipt: tampered, domain: "example.com", score: 0.99 });
const tamperedEvt = signEvent(tamperedTmpl, agent.secretKey);
const tamperedVerified = verifyFeedbackEvent(tamperedEvt);
if (tamperedVerified) {
  console.error("FAIL: tampered receipt passed verification!");
  process.exit(1);
}
console.log("[7] tampered receipt correctly rejected ✓");

// Negative test: different rater than buyer.
const otherAgent = crypto.generateKeyPairSync("ed25519"); // ed25519 just for crypto.generateKeyPairSync availability
// Use nostr-tools generateSecretKey instead — different key
import { generateSecretKey, getPublicKey } from "nostr-tools";
const wrongSk = generateSecretKey();
const wrongPk = getPublicKey(wrongSk);
const evtWrong = signEvent(tmpl, wrongSk);
const wrongVerified = verifyFeedbackEvent(evtWrong);
if (wrongVerified) {
  console.error("FAIL: rater-not-buyer event passed verification!");
  process.exit(1);
}
console.log("[8] rater-not-buyer correctly rejected ✓");

console.log("\nALL PASS");
process.exit(0);

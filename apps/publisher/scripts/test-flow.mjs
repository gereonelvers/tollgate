#!/usr/bin/env node
/**
 * Standalone end-to-end smoke test for the Tollgate flow.
 *
 *   AGENT_NWC_URL=nostr+walletconnect://... node scripts/test-flow.mjs [base-url]
 *   TOLLGATE_MOCK_LIGHTNING=1 node scripts/test-flow.mjs [base-url]   # offline mode
 *
 * Defaults base-url to http://localhost:3000.
 */

const BASE = process.argv[2] ?? "http://localhost:3000";
const MOCK = process.env.TOLLGATE_MOCK_LIGHTNING === "1";
const NWC_URL = process.env.AGENT_NWC_URL;

if (!MOCK && !NWC_URL) {
  console.error(
    "error: set AGENT_NWC_URL to your NWC connection URI before running, OR pass TOLLGATE_MOCK_LIGHTNING=1 for offline mode.",
  );
  process.exit(2);
}

function info(...m) {
  process.stdout.write("• " + m.join(" ") + "\n");
}
function bigStep(n, s) {
  process.stdout.write(`\n[${n}] ${s}\n`);
}
function check(ok, label, detail) {
  process.stdout.write(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}\n`);
  if (!ok) process.exit(1);
}

bigStep(1, `Manifest discovery${MOCK ? " (MOCK MODE)" : ""}`);
const mres = await fetch(`${BASE}/.well-known/agents402.json`);
check(mres.ok, "manifest endpoint reachable", `status=${mres.status}`);
const manifest = await mres.json();
check(manifest.version === "0.1", "manifest version", manifest.version);
check(manifest.actions?.length > 0, "manifest has actions", `${manifest.actions.length}`);
const action =
  manifest.actions.find((a) => a.id === "extract.structured") ??
  manifest.actions[0];
info(`will buy: ${action.id} for ${action.price_msats} msats (${action.price_msats / 1000} sats)`);
const sampleInput =
  action.id === "extract.structured"
    ? { doc_id: "doc.lightning_economics_2026" }
    : action.id === "ask.site_agent"
      ? { question: "Why do micropayments work for agents now?" }
      : {};

bigStep(2, "Trigger 402 challenge (unauth POST)");
const res402 = await fetch(action.endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(sampleInput),
});
check(res402.status === 402, "got 402 Payment Required", `status=${res402.status}`);
const body = await res402.json();
check(typeof body.invoice === "string", "invoice in body", body.invoice?.slice(0, 30) + "…");
check(typeof body.token === "string", "L402 token in body");
check(typeof body.payment_hash === "string", "payment hash returned", body.payment_hash);

bigStep(3, MOCK ? "Mock-pay invoice (offline)" : "Pay invoice via NWC");
let proof;
if (MOCK) {
  const r = await fetch(`${BASE}/api/dev/settle`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payment_hash: body.payment_hash }),
  });
  const j = await r.json();
  check(j.ok === true, "mock settle accepted", JSON.stringify(j));
  proof = "mockpreimage" + body.payment_hash.slice(0, 16);
  info(`mock proof: ${proof}`);
} else {
  const { NWCClient } = await import("@getalby/sdk");
  const wallet = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
  try {
    const t0 = Date.now();
    const r = await wallet.payInvoice({ invoice: body.invoice });
    info(`paid in ${Date.now() - t0}ms, fees: ${r.fees_paid ?? 0} msats`);
    info(`raw response: ${JSON.stringify(r)}`);
    proof = r.preimage && r.preimage.length > 0
      ? r.preimage
      : "settled-no-preimage-" + body.payment_hash.slice(0, 16);
    info(`using proof: ${proof}`);
  } catch (e) {
    check(false, "payInvoice succeeded", e?.message ?? String(e));
  }
  // Give the publisher's wallet a moment to receive the inbound payment notification.
  info("waiting 2s for receiver-side propagation…");
  await new Promise((r) => setTimeout(r, 2000));
}

bigStep(4, "Retry with Authorization");
const res200 = await fetch(action.endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `L402 ${body.token}:${proof}`,
  },
  body: JSON.stringify(sampleInput),
});
check(res200.ok, "action returned 200", `status=${res200.status}`);
const result = await res200.json();
check(typeof result.output === "object", "output present");
check(result.receipt?.signature?.length > 0, "receipt signed", result.receipt?.receipt_id);

bigStep("✓", `End-to-end ${MOCK ? "mock" : "mainnet"} flow verified.`);
process.stdout.write("\nReceipt:\n" + JSON.stringify(result.receipt, null, 2) + "\n");
process.stdout.write("\nOutput:\n" + JSON.stringify(result.output, null, 2) + "\n");
process.exit(0);

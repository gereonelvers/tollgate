import {
  DocLayout,
  H2,
  P,
  UL,
  LI,
  InlineCode,
  CodeBlock,
  Callout,
  PageHeader,
  NextLink,
  Table,
} from "@/components/doc-layout";

export const metadata = { title: "Receipts · agents402" };

const TOC = [
  { id: "what", text: "What a receipt is" },
  { id: "shape", text: "Shape" },
  { id: "signing", text: "Signing" },
  { id: "verify", text: "Verifying" },
  { id: "reputation", text: "Receipts → reputation" },
];

export default function Page() {
  return (
    <DocLayout activePath="/concepts/receipts" toc={TOC}>
      <PageHeader
        kicker="Concepts"
        title="Receipts"
        lead="Every paid action produces an Ed25519-signed JSON receipt. Receipts are the unit of trust in the agent web — portable, composable, cryptographically anchored to a specific payment."
      />

      <H2 id="what">What a receipt is</H2>
      <P>
        A receipt is a small JSON document, signed by the publisher&apos;s
        service key, that binds together five facts:
      </P>
      <UL>
        <LI>Which action ran (<InlineCode>action_id</InlineCode>)</LI>
        <LI>What input was provided (a hash, not the input itself)</LI>
        <LI>What output was returned (a hash)</LI>
        <LI>How much was paid, against which Lightning payment hash</LI>
        <LI>When it completed, signed by which key</LI>
      </UL>
      <P>
        Receipts are not stored on Lightning; they live in any database the
        agent or publisher chooses. Their integrity comes from Ed25519, and
        their evidentiary value comes from the underlying paid invoice (which
        Lightning anchors to physical bitcoin economics).
      </P>

      <H2 id="shape">Shape</H2>
      <CodeBlock filename="receipt" lang="json">
{`{
  "receipt_id":      "rcpt_a1b2c3d4e5f6",
  "action_id":       "ask.site_agent",
  "amount_msats":    3000,
  "payment_hash":    "9bb6b97be7d50917…",
  "input_hash":      "e467438db080543a…",
  "output_hash":     "8fa4e1c1e000f76d…",
  "completed_at":    "2026-04-26T10:22:01.412Z",
  "service_pubkey":  "302a300506032b6570032100…",
  "signature":       "83ac15b707b63dbc…"
}`}
      </CodeBlock>

      <H2 id="signing">Signing</H2>
      <P>
        The publisher computes the Ed25519 signature over the canonical JSON
        encoding of every field except <InlineCode>signature</InlineCode>{" "}
        itself, sorted by key, no insignificant whitespace. The signature is
        emitted as lowercase hex.
      </P>
      <CodeBlock filename="signing — Node.js" lang="ts">
{`const core = {
  receipt_id, action_id, amount_msats, payment_hash,
  input_hash, output_hash, completed_at, service_pubkey,
};
const msg = Buffer.from(canonicalJSON(core));
const sig = crypto.sign(null, msg, privateKey).toString("hex");
return { ...core, signature: sig };`}
      </CodeBlock>

      <H2 id="verify">Verifying</H2>
      <CodeBlock filename="verifying — Node.js" lang="ts">
{`function verifyReceipt(r, manifestPubkeyHex) {
  if (r.service_pubkey !== manifestPubkeyHex) return false;
  const { signature, ...core } = r;
  const pub = crypto.createPublicKey({
    key: Buffer.from(r.service_pubkey, "hex"),
    format: "der",
    type: "spki",
  });
  return crypto.verify(null, Buffer.from(canonicalJSON(core)), pub,
                       Buffer.from(signature, "hex"));
}`}
      </CodeBlock>
      <P>
        Verification is fully offline. An agent that has cached the
        publisher&apos;s manifest pubkey can verify any receipt from that
        publisher without further network access — useful for audit pipelines,
        reputation aggregators, and offline reasoning.
      </P>

      <H2 id="reputation">Receipts → reputation</H2>
      <P>
        Receipts power agents402&apos;s decentralized reputation system. When the
        buyer supplies a Nostr pubkey at payment time (the optional{" "}
        <InlineCode>buyer_pubkey</InlineCode> field), they can later publish a signed{" "}
        <a
          href="/spec/feedback"
          className="border-b border-zinc-300 text-zinc-950 hover:border-zinc-950 transition"
        >
          feedback event
        </a>{" "}
        embedding the receipt — provably tying their 0–1 score to a real Lightning
        payment. See{" "}
        <a
          href="/concepts/reputation"
          className="border-b border-zinc-300 text-zinc-950 hover:border-zinc-950 transition"
        >
          /concepts/reputation
        </a>
        .
      </P>
      <Callout variant="note" title="Local-first by design">
        agents402 does not require a global reputation graph. Each agent accumulates
        receipts it has issued or observed, optionally publishes feedback events on
        Nostr, and computes its own trust scoring policy locally. Receipts are the
        substrate; the graph is an emergent property of public, signed events.
      </Callout>
      <Table
        headers={["Signal", "What it tells you"]}
        rows={[
          ["Per-domain receipt count", "How active a service is, or how often this agent uses it."],
          ["Per-action receipt count", "Whether the service consistently fulfills a given action type."],
          ["Receipt volume over time", "Adoption trend, churn signal."],
          ["Signed buyer feedback", "Quality, in cases where the agent network publishes feedback events."],
          ["Receipt freshness", "Recency-weighted trust — old receipts decay."],
        ]}
      />

      <NextLink
        href="/concepts/trust"
        title="Trust model"
        description="Why the model never approves its own spend, and how the agent runtime enforces policy."
      />
    </DocLayout>
  );
}

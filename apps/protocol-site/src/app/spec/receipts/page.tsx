import {
  DocLayout,
  H2,
  P,
  UL,
  LI,
  InlineCode,
  CodeBlock,
  PageHeader,
  Table,
  NextLink,
} from "@/components/doc-layout";

export const metadata = { title: "Receipt format — Spec · faregate" };

const TOC = [
  { id: "schema", text: "JSON schema" },
  { id: "fields", text: "Field reference" },
  { id: "canonical", text: "Canonical form" },
  { id: "signing", text: "Signing & verifying" },
];

export default function Page() {
  return (
    <DocLayout activePath="/spec/receipts" toc={TOC}>
      <PageHeader
        kicker="Specification"
        title="Receipt format"
        lead="Wire-level reference for faregate receipts. Receipts are produced by the publisher on a successful paid action and signed with the publisher's service key."
      />

      <H2 id="schema">JSON schema</H2>
      <CodeBlock filename="faregate-receipt-v0.1.schema.json" lang="json">
{`{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type":    "object",
  "required": [
    "receipt_id", "action_id", "amount_msats", "payment_hash",
    "input_hash", "output_hash", "completed_at",
    "service_pubkey", "signature"
  ],
  "properties": {
    "receipt_id":     { "type": "string", "pattern": "^rcpt_[A-Za-z0-9_-]+$" },
    "action_id":      { "type": "string" },
    "amount_msats":   { "type": "integer", "minimum": 0 },
    "payment_hash":   { "type": "string", "pattern": "^[0-9a-f]{64}$" },
    "input_hash":     { "type": "string", "pattern": "^[0-9a-f]{64}$" },
    "output_hash":    { "type": "string", "pattern": "^[0-9a-f]{64}$" },
    "completed_at":   { "type": "string", "format": "date-time" },
    "service_pubkey": { "type": "string", "pattern": "^[0-9a-f]+$" },
    "signature":      { "type": "string", "pattern": "^[0-9a-f]+$" }
  }
}`}
      </CodeBlock>

      <H2 id="fields">Field reference</H2>
      <Table
        headers={["Field", "Description"]}
        rows={[
          [
            <InlineCode key="rid">receipt_id</InlineCode>,
            "Publisher-assigned identifier. Globally unique within the publisher's domain.",
          ],
          [
            <InlineCode key="aid">action_id</InlineCode>,
            "The id of the action that ran, exactly as published in the manifest.",
          ],
          [
            <InlineCode key="amt">amount_msats</InlineCode>,
            "Amount paid, in millisatoshis. Must equal the price quoted at challenge time.",
          ],
          [
            <InlineCode key="ph">payment_hash</InlineCode>,
            "Lightning payment hash for the BOLT11 invoice that was paid.",
          ],
          [
            <InlineCode key="ih">input_hash</InlineCode>,
            "SHA-256 of the canonical JSON of the action input.",
          ],
          [
            <InlineCode key="oh">output_hash</InlineCode>,
            "SHA-256 of the canonical JSON of the action output.",
          ],
          [
            <InlineCode key="ct">completed_at</InlineCode>,
            "RFC 3339 timestamp at which the publisher finalized the receipt.",
          ],
          [
            <InlineCode key="sp">service_pubkey</InlineCode>,
            "Ed25519 SPKI public key in hex. Must match the manifest's receipts.pubkey_hex.",
          ],
          [
            <InlineCode key="sig">signature</InlineCode>,
            "Ed25519 signature over the canonical-JSON encoding of every other field.",
          ],
        ]}
      />

      <H2 id="canonical">Canonical form</H2>
      <P>
        Canonical JSON for both hashing and signing follows{" "}
        <a
          href="https://www.rfc-editor.org/rfc/rfc8785"
          className="border-b border-zinc-300 text-zinc-950 hover:border-zinc-950 transition"
        >
          RFC 8785 (JCS)
        </a>
        : object keys sorted lexicographically, no insignificant whitespace,
        UTF-8 with strict escaping. Conforming implementations should use a
        canonicalization library rather than rolling their own.
      </P>

      <H2 id="signing">Signing & verifying</H2>
      <CodeBlock filename="signing — Node.js" lang="ts">
{`function signReceipt(core, privateKey) {
  const msg = Buffer.from(canonicalJSON(core));
  return crypto.sign(null, msg, privateKey).toString("hex");
}`}
      </CodeBlock>
      <CodeBlock filename="verifying — Node.js" lang="ts">
{`function verifyReceipt(receipt, expectedPubkeyHex) {
  if (receipt.service_pubkey !== expectedPubkeyHex) return false;
  const { signature, ...core } = receipt;
  const pub = crypto.createPublicKey({
    key: Buffer.from(receipt.service_pubkey, "hex"),
    format: "der", type: "spki",
  });
  return crypto.verify(null, Buffer.from(canonicalJSON(core)), pub,
                       Buffer.from(signature, "hex"));
}`}
      </CodeBlock>
      <UL>
        <LI>Verification is fully offline — no network calls required.</LI>
        <LI>An invalid signature on an otherwise-shaped receipt MUST be rejected.</LI>
        <LI>
          A receipt&apos;s <InlineCode>service_pubkey</InlineCode> must match the manifest&apos;s
          published key at the time the receipt was issued. Pubkey rotation
          handling is up to the agent&apos;s reputation logic.
        </LI>
      </UL>

      <NextLink
        href="/examples"
        title="Examples"
        description="Reference implementations of publishers, agents, and receipts."
      />
    </DocLayout>
  );
}

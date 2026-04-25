import {
  DocLayout,
  H2,
  H3,
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

export const metadata = { title: "Manifest · agents402" };

const TOC = [
  { id: "purpose", text: "Purpose" },
  { id: "shape", text: "Shape" },
  { id: "service", text: "service" },
  { id: "actions", text: "actions[]" },
  { id: "receipts", text: "receipts" },
  { id: "discovery", text: "Discovery rules" },
];

export default function Page() {
  return (
    <DocLayout activePath="/concepts/manifest" toc={TOC}>
      <PageHeader
        kicker="Concepts"
        title="The manifest"
        lead="A single JSON file at /.well-known/agents402.json that declares everything an agents402 publisher offers. Cacheable, versioned, signed by the publisher's service key."
      />

      <H2 id="purpose">Purpose</H2>
      <P>
        The manifest is the published API surface of an agents402 publisher.
        It exists so an agent can answer four questions with a single GET:
      </P>
      <UL>
        <LI>What does this site sell?</LI>
        <LI>How much does each thing cost?</LI>
        <LI>What inputs does each action expect?</LI>
        <LI>How do I verify the receipts I get back?</LI>
      </UL>
      <P>
        Everything else — auth, payment, retry — is consequence. The manifest
        is the only file an agent needs to read before deciding whether to
        engage with a publisher at all.
      </P>

      <H2 id="shape">Shape</H2>
      <CodeBlock filename="/.well-known/agents402.json" lang="json">
{`{
  "version": "0.1",
  "service": { … },
  "actions": [ … ],
  "receipts": {
    "pubkey_hex": "302a300506032b6570032100…",
    "algorithm":  "ed25519"
  }
}`}
      </CodeBlock>

      <H2 id="service">service</H2>
      <Table
        headers={["Field", "Type", "Required", "Description"]}
        rows={[
          [
            <InlineCode key="n">name</InlineCode>,
            "string",
            "yes",
            "Display name shown to the user when the agent reports spend.",
          ],
          [
            <InlineCode key="d">description</InlineCode>,
            "string",
            "no",
            "Short summary of what the publisher offers, used for log lines.",
          ],
          [
            <InlineCode key="h">homepage</InlineCode>,
            "url",
            "yes",
            "Canonical site URL — the agent uses this to compute trust against domain heuristics.",
          ],
          [
            <InlineCode key="l">lightning_address</InlineCode>,
            "string",
            "no",
            "Optional human-pingable LN address for ad-hoc top-ups or grants.",
          ],
        ]}
      />

      <H2 id="actions">actions[]</H2>
      <P>
        Each action is a fixed-price unit of agent-buyable work. The schema is:
      </P>
      <Table
        headers={["Field", "Type", "Required", "Description"]}
        rows={[
          [
            <InlineCode key="id">id</InlineCode>,
            "string",
            "yes",
            <>Stable identifier. Recommended dotted form like <InlineCode>category.thing</InlineCode>.</>,
          ],
          [
            <InlineCode key="type">type</InlineCode>,
            "enum",
            "yes",
            <>One of <InlineCode>web_access</InlineCode>, <InlineCode>structured_data</InlineCode>, <InlineCode>site_agent_query</InlineCode>, <InlineCode>verification</InlineCode>.</>,
          ],
          [
            <InlineCode key="endpoint">endpoint</InlineCode>,
            "url",
            "yes",
            "Absolute URL the agent POSTs to. Returns 402 first, 200 after payment.",
          ],
          [
            <InlineCode key="price">price_msats</InlineCode>,
            "integer ≥ 0",
            "yes",
            "Fixed price per call. Use millisatoshis for sub-cent pricing.",
          ],
          [
            <InlineCode key="schema">input_schema</InlineCode>,
            "JSON Schema",
            "no",
            "Deterministic input shape; the agent validates before paying.",
          ],
          [
            <InlineCode key="risk">risk</InlineCode>,
            "enum",
            "no",
            <>One of <InlineCode>low</InlineCode>, <InlineCode>medium</InlineCode>, <InlineCode>high</InlineCode>. Steers agent policy.</>,
          ],
        ]}
      />

      <Callout variant="warn" title="Action ids are commitments">
        Once published, an action id should mean a stable contract. Renaming an
        id breaks reputation and audit trails for downstream agents. Add a new
        action and deprecate the old one instead.
      </Callout>

      <H2 id="receipts">receipts</H2>
      <P>
        The publisher commits to an Ed25519 signing key. Every receipt is
        signed with that key; agents verify the signature using the public key
        from the manifest. Rotating the key is allowed but should be rare —
        existing receipts must remain verifiable, so old keys should be
        retained until the receipts referencing them have aged out of any
        downstream reputation system.
      </P>

      <H2 id="discovery">Discovery rules</H2>
      <UL>
        <LI>
          The manifest path is <InlineCode>/.well-known/agents402.json</InlineCode> on the canonical
          host. No other paths are honored.
        </LI>
        <LI>
          The response must be served with{" "}
          <InlineCode>Content-Type: application/json</InlineCode> and{" "}
          <InlineCode>Access-Control-Allow-Origin: *</InlineCode>.
        </LI>
        <LI>
          Caches should respect <InlineCode>Cache-Control</InlineCode> on the response. Recommended:{" "}
          <InlineCode>no-store</InlineCode> during early pilots; tighten later.
        </LI>
        <LI>
          A 404 on the manifest path means &ldquo;the publisher does not
          support agents402.&rdquo; Agents must not infer support from any
          other signal.
        </LI>
      </UL>

      <NextLink
        href="/concepts/actions"
        title="Actions"
        description="The unit of buyable work — types, pricing, and side effects."
      />
    </DocLayout>
  );
}

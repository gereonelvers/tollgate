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

export const metadata = { title: "Actions · agents402" };

const TOC = [
  { id: "definition", text: "What an action is" },
  { id: "types", text: "Action types" },
  { id: "pricing", text: "Pricing" },
  { id: "input", text: "Inputs" },
  { id: "output", text: "Outputs" },
  { id: "idempotency", text: "Idempotency" },
];

export default function Page() {
  return (
    <DocLayout activePath="/concepts/actions" toc={TOC}>
      <PageHeader
        kicker="Concepts"
        title="Actions"
        lead="A unit of agent-buyable work. Each action has a fixed price, a deterministic input, a typed output, and a clear cost-of-failure boundary."
      />

      <H2 id="definition">What an action is</H2>
      <P>
        An action is the smallest billable interaction. It must be:
      </P>
      <UL>
        <LI>
          <strong>Atomic.</strong> Either it completes and a receipt is issued, or
          payment is refunded and no receipt exists.
        </LI>
        <LI>
          <strong>Stateless from the agent&apos;s side.</strong> The same input
          must yield the same canonical output (modulo time-sensitive freshness).
          This makes the receipt&apos;s output hash meaningful.
        </LI>
        <LI>
          <strong>Independently priced.</strong> An action&apos;s price is its
          declared cost in the manifest. Bundles or subscriptions are not part
          of the v0.1 spec.
        </LI>
      </UL>

      <H2 id="types">Action types</H2>
      <Table
        headers={["Type", "Use case", "Typical price"]}
        rows={[
          [
            <InlineCode key="t1">web_access</InlineCode>,
            "Page or article body, license-bypassable read access",
            "1–10 sat",
          ],
          [
            <InlineCode key="t2">structured_data</InlineCode>,
            "Clean JSON for an entity (article metadata, profile, dataset row)",
            "1–10 sat",
          ],
          [
            <InlineCode key="t3">site_agent_query</InlineCode>,
            "Site-hosted Q&A over the publisher's archive, with citations",
            "3–30 sat",
          ],
          [
            <InlineCode key="t4">verification</InlineCode>,
            "Independent claim grading, fact-check, identity attestation",
            "5–500 sat",
          ],
        ]}
      />
      <P>
        These four cover most current agent purchases. New types may be added
        as the protocol evolves; agents must safely ignore unknown types when
        selecting actions to buy.
      </P>

      <H2 id="pricing">Pricing</H2>
      <P>
        Prices are denominated in millisatoshis (<InlineCode>price_msats</InlineCode>),
        which is the smallest unit Lightning carries (1 sat = 1000 msat). This
        permits sub-cent pricing while keeping integer arithmetic.
      </P>
      <Callout variant="tip" title="Pricing intuition">
        At 2026 prices, 1 sat ≈ $0.0006. A typical 5-action research task at
        1–3 sats per action is fractions of a US cent. Charge what the work is
        worth, not what humans would tolerate.
      </Callout>

      <H2 id="input">Inputs</H2>
      <P>
        Inputs are sent as a JSON body to the action endpoint. The publisher
        SHOULD declare an <InlineCode>input_schema</InlineCode> (any subset of JSON
        Schema). The agent MUST validate against it before paying.
      </P>
      <CodeBlock filename="example input_schema" lang="json">
{`{
  "type": "object",
  "properties": {
    "doc_id":  { "type": "string", "maxLength": 256 },
    "fields":  { "type": "array",  "items": { "type": "string" } }
  },
  "required": ["doc_id"]
}`}
      </CodeBlock>
      <P>
        Inputs are hashed (SHA-256 over canonical JSON) and bound to the L402
        token. An agent cannot reuse a token for a different input — this
        prevents bait-and-switch where one cheap quote is reused for an
        expensive call.
      </P>

      <H2 id="output">Outputs</H2>
      <P>
        Outputs are JSON. The publisher MUST canonicalize the output (sorted
        keys, no extra whitespace) before hashing into the receipt. This makes
        the receipt&apos;s <InlineCode>output_hash</InlineCode> a stable witness
        of what was delivered.
      </P>

      <H2 id="idempotency">Idempotency</H2>
      <P>
        Each L402 token is single-use. Once the publisher issues a receipt for
        a payment hash, the token is consumed. Subsequent retries with the same
        auth header MUST return <InlineCode>401</InlineCode> with{" "}
        <InlineCode>token_already_consumed</InlineCode>.
      </P>
      <P>
        For repeatable work, the agent simply pays again — payment is the
        idempotency key. Caching results client-side is the agent&apos;s
        responsibility.
      </P>

      <NextLink
        href="/concepts/receipts"
        title="Receipts"
        description="The signed proof of a paid action — what's bound, what's hashed, how to verify."
      />
    </DocLayout>
  );
}

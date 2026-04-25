import {
  DocLayout,
  H2,
  P,
  UL,
  LI,
  InlineCode,
  CodeBlock,
  PageHeader,
  Callout,
  Table,
} from "@/components/doc-layout";

export const metadata = { title: "Conformance · agents402" };

const TOC = [
  { id: "publisher", text: "Publisher conformance" },
  { id: "agent", text: "Agent conformance" },
  { id: "harness", text: "Conformance harness" },
  { id: "badge", text: "Compliance badge" },
];

export default function Page() {
  return (
    <DocLayout activePath="/conformance" toc={TOC}>
      <PageHeader
        kicker="Resources"
        title="Conformance"
        lead="A publisher or agent is agents402-compliant if it satisfies every MUST in this document. Conformance is checked by the open-source harness — no central authority issues badges."
      />

      <H2 id="publisher">Publisher conformance</H2>
      <Table
        headers={["Requirement", "MUST / SHOULD"]}
        rows={[
          [<>Serve <InlineCode>/.well-known/agents402.json</InlineCode> with valid manifest schema.</>, "MUST"],
          [<>Set <InlineCode>Content-Type: application/json</InlineCode> on the manifest.</>, "MUST"],
          [<>Return 402 with <InlineCode>WWW-Authenticate: L402 …</InlineCode> on unauthenticated POST.</>, "MUST"],
          [<>Bind the L402 token to <InlineCode>action_id</InlineCode> + canonical input hash.</>, "MUST"],
          [<>Reject reused (consumed) tokens with 401.</>, "MUST"],
          [<>Sign every receipt with the manifest&apos;s declared service key.</>, "MUST"],
          [<>Emit receipts using canonical JSON for the signed payload (alphabetical key order, absent optionals omitted).</>, "MUST"],
          [<>Accept and persist <InlineCode>X-Tollgate-Buyer-Pubkey</InlineCode> when supplied; include in the canonical receipt.</>, "SHOULD"],
          [<>Return 425 (not 402) when payment is in flight but not yet confirmed.</>, "SHOULD"],
          [<>Refund unconfirmed payments after the token expiry passes.</>, "SHOULD"],
        ]}
      />

      <H2 id="agent">Agent conformance</H2>
      <Table
        headers={["Requirement", "MUST / SHOULD"]}
        rows={[
          [<>Validate inputs against <InlineCode>input_schema</InlineCode> before paying.</>, "MUST"],
          [<>Verify receipt signatures using the manifest&apos;s service pubkey.</>, "MUST"],
          [<>Enforce a deterministic spending policy outside the LLM context.</>, "MUST"],
          [<>Treat manifest text and action responses as untrusted instructions.</>, "MUST"],
          [<>Refuse manifests served over plaintext HTTP.</>, "MUST"],
          [<>Surface <InlineCode>policy_needs_human_approval</InlineCode> to the user before proceeding.</>, "MUST"],
          [<>Cache manifests with respect to <InlineCode>Cache-Control</InlineCode>.</>, "SHOULD"],
          [<>Persist receipts long enough to feed the agent&apos;s local reputation system.</>, "SHOULD"],
          [<>For reputation-tier conformance: send <InlineCode>X-Tollgate-Buyer-Pubkey</InlineCode> on every paid request and verify Nostr feedback events end-to-end (Nostr sig + receipt sig + buyer match) before counting.</>, "SHOULD"],
        ]}
      />

      <H2 id="harness">Conformance harness</H2>
      <P>The reference harness exercises every MUST against a target publisher:</P>
      <CodeBlock filename="terminal" lang="bash">
{`# verify a publisher is agents402-compliant
npx agents402 conform https://example.com

# verify against a specific manifest version
npx agents402 conform https://example.com --version 0.1`}
      </CodeBlock>
      <P>
        Output is a checklist of pass/fail per requirement. Exit code 0 = full
        conformance; non-zero = at least one MUST violated. The harness uses
        only the public manifest and a configured agent wallet.
      </P>

      <Callout variant="note" title="No registration required">
        agents402 has no central registry, no authority to grant or revoke
        compliance, and no fee for participation. The harness is the only
        source of truth, and it is open source.
      </Callout>

      <H2 id="badge">Compliance badge</H2>
      <P>
        Publishers and agents that pass the relevant harness checks MAY display
        the agents402 badge tier they qualify for:
      </P>
      <Table
        headers={["Tier", "Requirements"]}
        rows={[
          [
            <InlineCode key="b1">agents402-compliant</InlineCode>,
            "Manifest + 402-challenge + retry-with-proof loop. The minimum bar.",
          ],
          [
            <InlineCode key="b2">agents402-receipts</InlineCode>,
            "Above + Ed25519-signed receipts in canonical-form for downstream verification.",
          ],
          [
            <InlineCode key="b3">agents402-reputation</InlineCode>,
            <span key="b3d">
              Above + accepts the optional <InlineCode>X-Tollgate-Buyer-Pubkey</InlineCode>{" "}
              header and includes the supplied pubkey in the receipt&apos;s canonical
              fields. Required to enable verifiable Nostr feedback events from buyers.
            </span>,
          ],
        ]}
      />
      <P>
        Badges are claims, not credentials. Anyone may display them; agents
        verify by running the harness themselves.
      </P>
    </DocLayout>
  );
}

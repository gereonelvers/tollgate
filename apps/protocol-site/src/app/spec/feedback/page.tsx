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

export const metadata = { title: "Feedback events — Spec · agents402" };

const TOC = [
  { id: "kind", text: "Event kind" },
  { id: "schema", text: "Event schema" },
  { id: "tags", text: "Tags" },
  { id: "content", text: "Content" },
  { id: "validation", text: "Validation pipeline" },
  { id: "replacement", text: "Replacement semantics" },
  { id: "relays", text: "Relay selection" },
  { id: "ephemeral", text: "Ephemeral identities" },
];

export default function Page() {
  return (
    <DocLayout activePath="/spec/feedback" toc={TOC}>
      <PageHeader
        kicker="Specification"
        title="Feedback events"
        lead="Wire-level reference for agents402 feedback events on Nostr — kind 30402, parameterized replaceable, receipt-anchored, schnorr-signed by the agent."
      />

      <H2 id="kind">Event kind</H2>
      <Table
        headers={["Property", "Value"]}
        rows={[
          ["Kind", <InlineCode key="k">30402</InlineCode>],
          ["Class", "Parameterized replaceable (NIP-01 §10)"],
          [
            "Replacement key",
            <span key="rk">
              <InlineCode>(pubkey, kind, d-tag)</InlineCode>; one event per (rater, receipt_id)
            </span>,
          ],
          ["Signing curve", "secp256k1 schnorr (Nostr standard)"],
          ["Encoding", "JSON, UTF-8"],
        ]}
      />

      <H2 id="schema">Event schema</H2>
      <CodeBlock filename="agents402-feedback-v0.1.event.schema.json" lang="json">
{`{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type":    "object",
  "required": ["kind", "pubkey", "created_at", "tags", "content", "sig", "id"],
  "properties": {
    "kind":       { "const": 30402 },
    "pubkey":     { "type": "string", "pattern": "^[0-9a-f]{64}$" },
    "created_at": { "type": "integer", "minimum": 0 },
    "tags":       { "$ref": "#/definitions/tags" },
    "content":    { "type": "string" },
    "sig":        { "type": "string", "pattern": "^[0-9a-f]{128}$" },
    "id":         { "type": "string", "pattern": "^[0-9a-f]{64}$" }
  }
}`}
      </CodeBlock>

      <H2 id="tags">Tags</H2>
      <P>
        Per NIP-01, only single-letter tag names are required to be relay-indexable.
        agents402 uses three indexable tags (<InlineCode>d</InlineCode>,{" "}
        <InlineCode>s</InlineCode>, <InlineCode>p</InlineCode>) for fast lookup, plus
        multi-letter tags for human inspection.
      </P>
      <Table
        headers={["Tag", "Indexable", "Value", "Description"]}
        rows={[
          [
            <InlineCode key="d">d</InlineCode>,
            "yes",
            "receipt_id",
            "The receipt being rated. Combined with pubkey forms the replacement key.",
          ],
          [
            <InlineCode key="s">s</InlineCode>,
            "yes",
            "service_pubkey hex",
            "Primary lookup tag. Aggregators query #s == service_pubkey.",
          ],
          [
            <InlineCode key="p">p</InlineCode>,
            "yes",
            "buyer_pubkey hex",
            "Lets clients query for all ratings published by a given rater.",
          ],
          [
            <InlineCode key="dom">domain</InlineCode>,
            "no",
            "string",
            "Publisher's canonical hostname, for human-readable filtering.",
          ],
          [
            <InlineCode key="aid">action_id</InlineCode>,
            "no",
            "string",
            "From receipt; lets aggregators slice scores per action type after retrieval.",
          ],
          [
            <InlineCode key="amt">amount_msats</InlineCode>,
            "no",
            "integer string",
            "From receipt. Used as the weight in Σ(amount × score).",
          ],
          [
            <InlineCode key="ph">payment_hash</InlineCode>,
            "no",
            "hex",
            "From receipt. Anchors to the underlying Lightning payment.",
          ],
          [
            <InlineCode key="sc">score</InlineCode>,
            "no",
            "string, 4-decimal",
            "Score in tag form for inspection. MUST equal content.score.",
          ],
        ]}
      />

      <H2 id="content">Content</H2>
      <P>
        The <InlineCode>content</InlineCode> field is a JSON-encoded string with shape:
      </P>
      <CodeBlock lang="json">
{`{
  "score":   0.92,                  // float in [0, 1]
  "note":    "useful, fast",        // optional, ≤ 280 chars
  "receipt": { …signed receipt… }   // full signed receipt JSON, see /spec/receipts
}`}
      </CodeBlock>
      <P>
        The embedded receipt is what makes the event verifiable. Aggregators MUST parse
        and validate it before counting the rating.
      </P>

      <H2 id="validation">Validation pipeline</H2>
      <P>To accept a feedback event, an aggregator MUST:</P>
      <UL>
        <LI>
          Verify the Nostr event signature against <InlineCode>event.pubkey</InlineCode>{" "}
          (standard NIP-01).
        </LI>
        <LI>
          Confirm <InlineCode>event.kind === 30402</InlineCode>.
        </LI>
        <LI>
          Parse <InlineCode>event.content</InlineCode> as JSON; require{" "}
          <InlineCode>{`{ score, receipt }`}</InlineCode> with score ∈ [0, 1].
        </LI>
        <LI>
          Verify <InlineCode>receipt.buyer_pubkey === event.pubkey</InlineCode> — the
          rater paid for the action.
        </LI>
        <LI>
          Verify <InlineCode>receipt.signature</InlineCode> is a valid Ed25519
          signature over the receipt&apos;s canonical JSON form (see{" "}
          <a
            href="/spec/receipts"
            className="border-b border-zinc-300 text-zinc-950 hover:border-zinc-950 transition"
          >
            /spec/receipts
          </a>
          ).
        </LI>
        <LI>
          Confirm tag/content consistency: <InlineCode>tag.d === receipt.receipt_id</InlineCode>,{" "}
          <InlineCode>tag.service_pubkey === receipt.service_pubkey</InlineCode>, etc.
        </LI>
        <LI>Drop the event silently on any failure. Do not surface invalid ratings.</LI>
      </UL>

      <H2 id="replacement">Replacement semantics</H2>
      <P>
        Per NIP-01, parameterized replaceable events: when two events share{" "}
        <InlineCode>(pubkey, kind, d-tag)</InlineCode>, only the one with the latest{" "}
        <InlineCode>created_at</InlineCode> counts. Ties broken by lexicographic{" "}
        <InlineCode>id</InlineCode>. Aggregators MUST honor this when counting events.
      </P>
      <Callout variant="note" title="Why replaceable">
        Agents may need to amend their score later — &ldquo;the result was useful at
        first but turned out wrong&rdquo; or &ldquo;I rated low but realized the format
        was just non-standard.&rdquo; Replaceable events allow honest updates without
        bloating relays with history.
      </Callout>

      <H2 id="relays">Relay selection</H2>
      <P>Reference set used by the Tollgate MCP server:</P>
      <CodeBlock lang="text">
{`wss://relay.damus.io
wss://nos.lol
wss://relay.primal.net`}
      </CodeBlock>
      <P>
        Override via the <InlineCode>TOLLGATE_NOSTR_RELAYS</InlineCode> environment
        variable (comma-separated). Agents SHOULD publish to at least 3 relays for
        redundancy and SHOULD subscribe to at least the same 3 when fetching reputation.
      </P>

      <H2 id="ephemeral">Ephemeral identities</H2>
      <P>
        For privacy-sensitive purchases the agent MAY generate a one-time keypair, use
        its public key as <InlineCode>buyer_pubkey</InlineCode> at payment time, sign
        the feedback event with the matching secret key, and discard the secret. The
        rating is verifiable but not linkable to the agent&apos;s persistent identity.
      </P>
      <Callout variant="warn" title="Cost of ephemerality">
        Ephemeral ratings count just as much as persistent ones in the weighted-score
        formula, but they don&apos;t accumulate a per-rater track record. Aggregators
        that filter by &ldquo;raters with N+ prior receipts&rdquo; will exclude them.
      </Callout>

      <NextLink
        href="/conformance"
        title="Conformance"
        description="MUST/SHOULD requirements for publishers, agents, and reputation participants."
      />
    </DocLayout>
  );
}

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
  Table,
  NextLink,
} from "@/components/doc-layout";

export const metadata = { title: "Wire format — Spec · faregate" };

const TOC = [
  { id: "challenge", text: "402 challenge" },
  { id: "token", text: "L402 token" },
  { id: "retry", text: "Retry with proof" },
  { id: "errors", text: "Error responses" },
  { id: "timing", text: "Timing & retries" },
];

export default function Page() {
  return (
    <DocLayout activePath="/spec/wire" toc={TOC}>
      <PageHeader
        kicker="Specification"
        title="Wire format"
        lead="The exact HTTP shape of a paid action — request, 402 challenge, payment, retry, and 200 with receipt."
      />

      <H2 id="challenge">402 challenge</H2>
      <P>The first request to an action endpoint MUST omit the <InlineCode>Authorization</InlineCode> header.</P>
      <CodeBlock filename="request 1" lang="http">
{`POST /api/actions/extract.structured HTTP/1.1
Host: example.com
Content-Type: application/json

{ "doc_id": "doc.foo" }`}
      </CodeBlock>
      <P>The publisher responds with HTTP 402 and the L402 challenge:</P>
      <CodeBlock filename="response 1" lang="http">
{`HTTP/1.1 402 Payment Required
Content-Type: application/json
WWW-Authenticate: L402 macaroon="<base64>", invoice="lnbc…"

{
  "error":         "payment_required",
  "action_id":     "extract.structured",
  "amount_msats":  1000,
  "invoice":       "lnbc10n1p…",
  "payment_hash":  "9bb6…",
  "token":         "<base64>",
  "expires_at":    1777160234
}`}
      </CodeBlock>

      <H2 id="token">L402 token</H2>
      <P>
        The token is opaque to the agent. It is structured for stateless
        verification on the publisher side; the recommended encoding is:
      </P>
      <CodeBlock lang="text">
{`base64url(JSON_BODY) "." base64url(HMAC_SHA256(secret, base64url(JSON_BODY)))

JSON_BODY = {
  "ph":  payment_hash,
  "sc":  action_id ":" sha256(canonical_input),
  "exp": unix_seconds,
  "n":   random_nonce
}`}
      </CodeBlock>
      <P>
        Equivalent macaroon-formatted tokens are accepted. The wire format only
        cares that the token is opaque, parseable in a known format, and that
        the publisher can verify it.
      </P>

      <H2 id="retry">Retry with proof</H2>
      <CodeBlock filename="request 2" lang="http">
{`POST /api/actions/extract.structured HTTP/1.1
Host: example.com
Content-Type: application/json
Authorization: L402 <token>:<preimage>

{ "doc_id": "doc.foo" }`}
      </CodeBlock>
      <P>
        The agent supplies the token returned in the 402, plus the
        Lightning preimage from its wallet. The publisher verifies:
      </P>
      <UL>
        <LI>Token signature (HMAC valid).</LI>
        <LI>Token scope matches <InlineCode>action_id</InlineCode> + canonical input hash.</LI>
        <LI>Token <InlineCode>exp</InlineCode> in the future.</LI>
        <LI>
          Either: <InlineCode>sha256(preimage) == payment_hash</InlineCode> (cryptographic), OR
          the publisher&apos;s wallet reports the invoice as settled (operational fallback).
        </LI>
        <LI>Token has not been previously consumed.</LI>
      </UL>
      <P>On success the publisher returns:</P>
      <CodeBlock filename="response 2" lang="http">
{`HTTP/1.1 200 OK
Content-Type: application/json

{
  "output":  { … },
  "receipt": { …signed receipt… }
}`}
      </CodeBlock>

      <H2 id="errors">Error responses</H2>
      <Table
        headers={["Status", "Code", "When"]}
        rows={[
          ["400", <InlineCode key="a">invalid_input</InlineCode>, "Input fails the action's input_schema."],
          ["401", <InlineCode key="b">invalid_or_expired_token</InlineCode>, "Token signature invalid or expired."],
          ["401", <InlineCode key="c">preimage_mismatch</InlineCode>, "sha256(preimage) ≠ payment_hash."],
          ["401", <InlineCode key="d">token_already_consumed</InlineCode>, "Token was previously redeemed."],
          ["402", <InlineCode key="e">payment_required</InlineCode>, "Initial 402 (challenge issuance)."],
          ["425", <InlineCode key="f">payment_not_confirmed</InlineCode>, "Settle status not yet visible at publisher's wallet."],
          ["503", <InlineCode key="g">invoice_creation_failed</InlineCode>, "Publisher's wallet temporarily unable to issue invoices."],
        ]}
      />
      <Callout variant="note" title="425 vs 402">
        425 (Too Early) signals &ldquo;your payment is in flight, retry the same
        request shortly.&rdquo; The agent does NOT need to pay again; it just
        retries with the same Authorization header.
      </Callout>

      <H2 id="timing">Timing & retries</H2>
      <UL>
        <LI>Agents SHOULD wait at least 1 s between 425 retries; back off to 5 s by attempt 3.</LI>
        <LI>Agents SHOULD give up after 30 s of 425 responses and surface the failure.</LI>
        <LI>Publishers SHOULD set a token <InlineCode>exp</InlineCode> of 5–15 minutes after issuance.</LI>
        <LI>Publishers SHOULD NOT consume a token until they have actually issued the receipt.</LI>
      </UL>

      <NextLink
        href="/spec/receipts"
        title="Receipt format"
        description="Exact JSON shape, canonicalization rules, and signature verification."
      />
    </DocLayout>
  );
}

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
} from "@/components/doc-layout";
import { InstallButtons } from "@/components/install-buttons";

export const metadata = {
  title: "Introduction · agents402",
};

const TOC = [
  { id: "what", text: "What it is" },
  { id: "install", text: "Install the agent side" },
  { id: "shape", text: "The shape of it" },
  { id: "why", text: "Why now" },
  { id: "scope", text: "What's in / out of scope" },
  { id: "next", text: "Where to go next" },
];

export default function Page() {
  return (
    <DocLayout activePath="/" toc={TOC}>
      <PageHeader
        kicker="Introduction"
        title="agents402"
        lead="An open paid-action protocol for AI agents. Sites declare what an agent can buy in a single JSON manifest; agents pay over the Lightning Network under deterministic policy; every paid action ships a signed, portable receipt."
      />

      <H2 id="what">What it is</H2>
      <P>
        agents402 is the small contract between two parties on the agent web: a
        site offering machine-readable paid capabilities, and an AI agent
        empowered to buy them. It is a thin layer above the Lightning HTTP{" "}
        <InlineCode>402 Payment Required</InlineCode> standard (L402), shaped
        for autonomous use rather than human-checkout flows.
      </P>
      <P>
        The smallest implementation is a static JSON file at{" "}
        <InlineCode>/.well-known/agents402.json</InlineCode>, a route handler
        that issues an L402 challenge, and a wallet on either end. Everything
        else — pricing, policy, receipts, reputation — composes from there.
      </P>

      <H2 id="install">Install the agent side</H2>
      <P>
        The reference MCP server is published as{" "}
        <InlineCode>@agents402/mcp</InlineCode>. Drop it into any MCP-aware
        client and the first time your agent hits a paywall, it will walk
        you through pairing a Lightning wallet.
      </P>
      <InstallButtons />

      <H2 id="shape">The shape of it</H2>
      <CodeBlock filename="GET https://example.com/.well-known/agents402.json" lang="json">
{`{
  "version": "0.1",
  "service": {
    "name":     "Example Pub",
    "homepage": "https://example.com"
  },
  "actions": [
    {
      "id":            "ask.site_agent",
      "type":          "site_agent_query",
      "endpoint":      "https://example.com/api/actions/ask.site_agent",
      "method":        "POST",
      "price_msats":   3000,
      "input_schema":  { "type": "object", "properties": { "question": { "type": "string" } } },
      "risk":          "low"
    }
  ],
  "receipts": {
    "pubkey_hex": "302a300506032b6570032100…",
    "algorithm":  "ed25519"
  }
}`}
      </CodeBlock>

      <P>
        An agent fetches that manifest, picks an action, and POSTs to the
        endpoint with its input. The first request returns 402 with an L402
        macaroon and a Lightning invoice. The agent pays the invoice, retries
        with the proof, and gets the result plus a signed receipt.
      </P>

      <H2 id="why">Why now</H2>
      <UL>
        <LI>
          <strong>Agent traffic dominates.</strong> A growing share of HTTP
          requests come from autonomous LLM agents, not humans. Consent and
          monetization are unsolved.
        </LI>
        <LI>
          <strong>Card rails fail at this scale.</strong> Sub-cent payments are
          uneconomic on Visa/Mastercard. CAPTCHA, 3DS, and account creation
          are hostile to agents.
        </LI>
        <LI>
          <strong>Stablecoins re-centralize.</strong> Most are controlled by a
          single issuer who sets rules and can freeze funds. The agent web
          shouldn&apos;t depend on anyone&apos;s permission.
        </LI>
        <LI>
          <strong>Lightning is finally fast and small.</strong> Mainnet
          settlements complete in &lt; 2 s at fractions of a cent — across
          borders, with no gateway. The rail finally fits the customer.
        </LI>
      </UL>

      <H2 id="scope">What&apos;s in / out of scope</H2>
      <P>
        agents402 specifies the wire format for discovery, payment challenge,
        retry-with-proof, and signed receipts. It does <em>not</em> specify a
        wallet implementation, a reputation graph, or a global registry. Those
        are intentionally separate — wallets are pluggable, reputation is
        local-first, and there is no central authority.
      </P>
      <Callout variant="note" title="Layering">
        agents402 sits above L402 (Lightning HTTP 402), which sits above
        Lightning. On the agent side it is typically consumed via{" "}
        <InlineCode>@modelcontextprotocol</InlineCode> tools that wrap a
        Nostr-Wallet-Connect-controlled wallet.
      </Callout>

      <H2 id="next">Where to go next</H2>
      <NextLink
        href="/quickstart"
        title="Quickstart"
        description="Stand up an agents402 publisher and agent in five minutes."
      />
    </DocLayout>
  );
}

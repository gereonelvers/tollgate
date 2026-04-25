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

export const metadata = { title: "Quickstart · faregate" };

const TOC = [
  { id: "step-1", text: "1. Install the publisher middleware" },
  { id: "step-2", text: "2. Add the manifest" },
  { id: "step-3", text: "3. Wrap an action" },
  { id: "step-4", text: "4. Wire up a Lightning wallet" },
  { id: "step-5", text: "5. Talk to the agent side" },
  { id: "verify", text: "Verify with a real payment" },
];

export default function Page() {
  return (
    <DocLayout activePath="/quickstart" toc={TOC}>
      <PageHeader
        kicker="Get started"
        title="Quickstart"
        lead="Stand up a faregate publisher and a paying agent in five minutes. The reference implementation uses Next.js, Nostr Wallet Connect, and a Model Context Protocol server."
      />

      <H2 id="step-1">1. Install the publisher middleware</H2>
      <CodeBlock filename="terminal" lang="bash">
{`npm install @faregate/server-next @getalby/sdk zod`}
      </CodeBlock>
      <P>
        The reference Next.js middleware exposes the manifest, signs receipts
        with an ed25519 service key, and ships an L402 challenge wrapper for
        any route handler.
      </P>

      <H2 id="step-2">2. Add the manifest</H2>
      <P>
        Drop a route at <InlineCode>app/.well-known/faregate.json/route.ts</InlineCode>:
      </P>
      <CodeBlock filename="app/.well-known/faregate.json/route.ts" lang="ts">
{`import { NextResponse } from "next/server";
import { listActions, getServiceKeys } from "@faregate/server-next";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    version: "0.1",
    service: {
      name:     "Example Pub",
      homepage: process.env.PUBLIC_URL,
    },
    actions:  listActions(),
    receipts: {
      pubkey_hex: getServiceKeys().publicKey,
      algorithm:  "ed25519",
    },
  });
}`}
      </CodeBlock>

      <H2 id="step-3">3. Wrap an action</H2>
      <CodeBlock filename="app/api/actions/extract.structured/route.ts" lang="ts">
{`import { withL402 } from "@faregate/server-next";

export const POST = withL402(
  {
    id:          "extract.structured",
    type:        "structured_data",
    price_msats: 1000,
    risk:        "low",
    input: {
      doc_id: { type: "string", maxLength: 256 },
    },
  },
  async ({ input }) => {
    const doc = await loadDoc(input.doc_id);
    return { title: doc.title, summary: doc.summary };
  },
);`}
      </CodeBlock>
      <P>
        The wrapper handles 402 challenge issuance, token signing, idempotency,
        and receipt creation. Your handler runs only after payment is
        confirmed.
      </P>

      <H2 id="step-4">4. Wire up a Lightning wallet</H2>
      <P>
        The publisher needs a Lightning wallet that can issue invoices and
        confirm settlement. Use any{" "}
        <a
          href="https://nips.nostr.com/47"
          className="border-b border-zinc-300 text-zinc-950 hover:border-zinc-950 transition"
        >
          NIP-47 NWC
        </a>
        -compatible wallet (Coinos, Alby Hub, LNbits, Primal, &hellip;):
      </P>
      <CodeBlock filename=".env.local" lang="dotenv">
{`PUBLISHER_NWC_URL=nostr+walletconnect://…
L402_SECRET=any-random-string`}
      </CodeBlock>
      <Callout variant="tip" title="No node operations">
        faregate verification is purely cryptographic ({" "}
        <InlineCode>sha256(preimage) == payment_hash</InlineCode>). The
        publisher can confirm a payment without running its own Lightning node
        in the request path — any NWC-compatible wallet provides the few
        operations needed.
      </Callout>

      <H2 id="step-5">5. Talk to the agent side</H2>
      <P>
        The reference agent integration is a Model Context Protocol (MCP)
        server that gives Claude (or any MCP-aware client) three tools:
      </P>
      <UL>
        <LI>
          <InlineCode>discover</InlineCode> — fetches a manifest, surfaces actions and prices
        </LI>
        <LI>
          <InlineCode>pay_and_invoke</InlineCode> — pays the L402 challenge under deterministic policy and runs the action
        </LI>
        <LI>
          <InlineCode>spend_summary</InlineCode> — reports today&apos;s spend and remaining budget
        </LI>
      </UL>
      <CodeBlock filename=".mcp.json" lang="json">
{`{
  "mcpServers": {
    "faregate": {
      "command": "node",
      "args":    ["./dist/mcp-server.js"],
      "env":     { "AGENT_NWC_URL": "nostr+walletconnect://…" }
    }
  }
}`}
      </CodeBlock>

      <H2 id="verify">Verify with a real payment</H2>
      <CodeBlock filename="terminal" lang="bash">
{`npx faregate test https://your-publisher.example`}
      </CodeBlock>
      <P>
        The conformance harness fetches the manifest, triggers a 402, pays from
        the configured agent wallet, retries with proof, and validates the
        signed receipt. Exit code 0 = end-to-end mainnet flow verified.
      </P>

      <NextLink
        href="/concepts/manifest"
        title="The manifest"
        description="The single JSON file that defines a faregate publisher."
      />
    </DocLayout>
  );
}

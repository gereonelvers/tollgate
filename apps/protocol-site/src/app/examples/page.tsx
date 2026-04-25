import {
  DocLayout,
  H2,
  P,
  InlineCode,
  CodeBlock,
  PageHeader,
  NextLink,
} from "@/components/doc-layout";

export const metadata = { title: "Examples · faregate" };

const TOC = [
  { id: "publisher-next", text: "Publisher (Next.js)" },
  { id: "publisher-cf", text: "Publisher (Cloudflare Worker)" },
  { id: "agent-mcp", text: "Agent (MCP server)" },
  { id: "agent-cli", text: "Agent (CLI)" },
];

export default function Page() {
  return (
    <DocLayout activePath="/examples" toc={TOC}>
      <PageHeader
        kicker="Resources"
        title="Examples"
        lead="Drop-in reference snippets for the most common faregate implementations. Each example assumes the canonical /.well-known/faregate.json manifest is already in place."
      />

      <H2 id="publisher-next">Publisher (Next.js)</H2>
      <P>
        A paid Next.js route handler. Issues a 402 on the first request and
        returns the action result + signed receipt on the retry.
      </P>
      <CodeBlock filename="app/api/actions/[id]/route.ts" lang="ts">
{`import { NextRequest, NextResponse } from "next/server";
import { createInvoice, isInvoiceSettled } from "@/lib/nwc";
import { issueL402Token, parseL402Auth, verifyL402Token } from "@/lib/l402";
import { getAction, hashInput, hashOutput } from "@/lib/actions";
import { signReceipt } from "@/lib/keys";
import { recordChallenge, insertReceipt } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const def = getAction(id);
  if (!def) return NextResponse.json({ error: "unknown_action" }, { status: 404 });

  const input = await req.json();
  const inputHash = hashInput(input);
  const auth = parseL402Auth(req.headers.get("authorization"));

  if (!auth) {
    const inv = await createInvoice({
      amountMsats: def.price_msats,
      description: \`faregate:\${id}\`,
    });
    const token = issueL402Token({
      paymentHash: inv.payment_hash,
      scope:       \`\${id}:\${inputHash}\`,
    });
    recordChallenge({ payment_hash: inv.payment_hash, action_id: id, input_hash: inputHash, amount_msats: def.price_msats });
    return NextResponse.json(
      { error: "payment_required", invoice: inv.invoice, token, payment_hash: inv.payment_hash },
      { status: 402, headers: { "WWW-Authenticate": \`L402 macaroon="\${token}", invoice="\${inv.invoice}"\` } },
    );
  }

  const tokenBody = verifyL402Token(auth.token, \`\${id}:\${inputHash}\`);
  if (!tokenBody) return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 401 });
  if (!await isInvoiceSettled(tokenBody.ph))
    return NextResponse.json({ error: "payment_not_confirmed" }, { status: 425 });

  const result = await def.handler(input);
  const receipt = signReceipt({
    receipt_id:    \`rcpt_\${crypto.randomUUID()}\`,
    action_id:     id,
    amount_msats:  def.price_msats,
    payment_hash:  tokenBody.ph,
    input_hash:    inputHash,
    output_hash:   hashOutput(JSON.stringify(result)),
    completed_at:  new Date().toISOString(),
  });
  insertReceipt(receipt);
  return NextResponse.json({ output: result, receipt });
}`}
      </CodeBlock>

      <H2 id="publisher-cf">Publisher (Cloudflare Worker)</H2>
      <P>
        Identical logic, edge-deployed. Replace the SQLite calls with a KV or
        D1 store. The faregate protocol is request-shape-only, so the runtime
        is up to you.
      </P>
      <CodeBlock filename="src/index.ts" lang="ts">
{`export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/.well-known/faregate.json") return manifestResponse(env);

    const match = /^\\/api\\/actions\\/([a-z][a-z0-9_.-]*)$/.exec(url.pathname);
    if (req.method === "POST" && match) {
      return handlePaidAction(match[1], req, env);
    }
    return new Response("not found", { status: 404 });
  },
};`}
      </CodeBlock>

      <H2 id="agent-mcp">Agent (MCP server)</H2>
      <P>
        The reference agent is a Model Context Protocol server. It exposes
        three tools to the LLM client; policy enforcement happens in code, not
        in the model.
      </P>
      <CodeBlock filename="mcp-server/src/index.ts" lang="ts">
{`import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchManifest } from "./manifest";
import { evaluate, loadPolicy } from "./policy";
import { payInvoice } from "./wallet";
import { recordReceipt, todaysSpendMsats, isKnownService } from "./db";

const server = new McpServer({ name: "faregate", version: "0.1.0" });

server.tool(
  "pay_and_invoke",
  "Pay an L402 challenge under deterministic policy and return the result + receipt.",
  {
    url:       z.string(),
    action_id: z.string(),
    input:     z.record(z.string(), z.unknown()),
    purpose:   z.string().optional(),
  },
  async ({ url, action_id, input, purpose }) => {
    const m = await fetchManifest(url);
    const action = m?.actions.find((a) => a.id === action_id);
    if (!action) throw new Error("action_not_in_manifest");

    const decision = evaluate({
      policy:              loadPolicy(),
      action_type:         action.type,
      amount_msats:        action.price_msats,
      domain:              new URL(url).host,
      todays_spend_msats:  todaysSpendMsats(),
      is_known_service:    isKnownService(new URL(url).host),
    });
    if (decision.decision !== "allow") throw new Error("policy_" + decision.decision);

    const challenge = await fetch(action.endpoint, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
    });
    const { invoice, token } = await challenge.json();
    const { preimage } = await payInvoice(invoice);

    const final = await fetch(action.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: \`L402 \${token}:\${preimage}\` },
      body: JSON.stringify(input),
    });
    const { output, receipt } = await final.json();
    recordReceipt({ ...receipt, domain: new URL(url).host, preimage });
    return { content: [{ type: "text", text: JSON.stringify({ output, receipt, purpose }) }] };
  },
);

await server.connect(new StdioServerTransport());`}
      </CodeBlock>

      <H2 id="agent-cli">Agent (CLI)</H2>
      <P>
        For non-MCP integrations, the faregate reference CLI does the same
        flow as a single command:
      </P>
      <CodeBlock filename="terminal" lang="bash">
{`AGENT_NWC_URL='nostr+walletconnect://…' \\
  npx faregate invoke https://example.com extract.structured \\
  --input '{"doc_id":"doc.foo"}' --max-msats 5000`}
      </CodeBlock>
      <P>
        Outputs the action result, the signed receipt, and the running daily
        spend. Exit code 0 = success, 2 = policy refusal, 3 = payment failure,
        4 = action failure post-payment.
      </P>

      <NextLink
        href="/conformance"
        title="Conformance"
        description="What makes a publisher and agent faregate-compliant."
      />
    </DocLayout>
  );
}

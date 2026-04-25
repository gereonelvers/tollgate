#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchManifest, domainOf, manifestUrlFor, ManifestAction } from "./manifest-client.js";
import { evaluate, loadPolicy } from "./policy.js";
import { isKnownService, recordReceipt, spendSummary, todaysSpendMsats } from "./db.js";
import { parseChallengeFromResponse, buildAuthorizationHeader } from "./l402-client.js";
import { payInvoice, getBalance } from "./wallet.js";

const server = new McpServer({ name: "tollgate", version: "0.1.0" });

const log = (...args: unknown[]) => {
  process.stderr.write(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ") + "\n");
};

// ------------------------------------------------------------------
// discover
// ------------------------------------------------------------------
server.tool(
  "discover",
  "Look up a Tollgate manifest for a URL or domain. Returns the list of paid actions a site offers, with prices and risk levels. Call this BEFORE pay_and_invoke whenever you encounter a new site or want to see what's available.",
  {
    url: z.string().describe("A URL or domain (e.g. example.com or https://example.com/article)."),
  },
  async ({ url }) => {
    const manifestUrl = manifestUrlFor(url);
    const manifest = await fetchManifest(url);
    if (!manifest) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                supports_tollgate: false,
                manifest_url: manifestUrl,
                hint: "Site does not expose /.well-known/agents402.json or it failed to parse.",
              },
              null,
              2,
            ),
          },
        ],
      };
    }
    const domain = domainOf(url);
    const known = isKnownService(domain);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              supports_tollgate: true,
              manifest_url: manifestUrl,
              service: manifest.service,
              actions: manifest.actions.map((a) => ({
                id: a.id,
                type: a.type,
                title: a.title,
                description: a.description,
                price_msats: a.price_msats,
                price_sats: a.price_msats / 1000,
                risk: a.risk ?? "low",
                input_schema: a.input_schema,
              })),
              local_reputation: {
                domain,
                known_to_us: known,
                successful_receipts: known
                  ? spendSummary("all").by_domain.find((d) => d.domain === domain)?.count ?? 0
                  : 0,
              },
              receipts_pubkey: manifest.receipts.pubkey_hex,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ------------------------------------------------------------------
// pay_and_invoke
// ------------------------------------------------------------------
server.tool(
  "pay_and_invoke",
  "Atomically: fetch a paid action, pay the L402 challenge under deterministic policy, return the result + receipt. ALWAYS prefer this over any direct fetch. Policy is enforced in code, not via the model — if the call would exceed budget or violate policy, this tool refuses.",
  {
    url: z
      .string()
      .describe(
        "Site URL or domain (e.g. example.com). Used to look up the manifest and determine the action endpoint.",
      ),
    action_id: z.string().describe("The action id to invoke (from discover). e.g. ask.site_agent."),
    input: z
      .record(z.string(), z.unknown())
      .describe("The JSON input for the action. Must conform to the action's input_schema."),
    purpose: z
      .string()
      .optional()
      .describe(
        "Short human-readable reason this call is being made. Logged for the user's audit trail.",
      ),
  },
  async ({ url, action_id, input, purpose }) => {
    const manifest = await fetchManifest(url);
    if (!manifest) {
      return errorResult({
        error: "manifest_not_found",
        url: manifestUrlFor(url),
        hint: "This site doesn't expose /.well-known/agents402.json. Cannot pay for actions.",
      });
    }
    const action: ManifestAction | undefined = manifest.actions.find((a) => a.id === action_id);
    if (!action) {
      return errorResult({
        error: "action_not_in_manifest",
        action_id,
        available: manifest.actions.map((a) => a.id),
      });
    }

    const domain = domainOf(url);
    const policy = loadPolicy();
    const todaysSpend = todaysSpendMsats();
    const decision = evaluate({
      policy,
      action_type: action.type,
      amount_msats: action.price_msats,
      domain,
      todays_spend_msats: todaysSpend,
      is_known_service: isKnownService(domain),
    });
    if (decision.decision !== "allow") {
      return errorResult({
        error: "policy_" + decision.decision,
        reason: decision.reason,
        action_id,
        amount_msats: action.price_msats,
        domain,
        purpose,
        suggestion:
          decision.decision === "needs_human_approval"
            ? "Tell the user the cost and reason; ask them to add the domain to trusted_domains or raise require_confirm_above_msats if they approve."
            : undefined,
      });
    }

    // Step 1: trigger 402 challenge.
    const challengeRes = await fetch(action.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (challengeRes.status !== 402) {
      // Some sites might serve the action free or return an error.
      const text = await challengeRes.text();
      return errorResult({
        error: "expected_402",
        got: challengeRes.status,
        body_preview: text.slice(0, 500),
      });
    }
    const challenge = await parseChallengeFromResponse(challengeRes);

    // Step 2: pay the invoice via NWC.
    let paid;
    try {
      paid = await payInvoice(challenge.invoice);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return errorResult({ error: "payment_failed", detail: msg, invoice: challenge.invoice.slice(0, 60) + "…" });
    }

    // Step 3: retry with Authorization header.
    const authHeader = buildAuthorizationHeader(challenge.token, paid.preimage);
    const finalRes = await fetch(action.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: authHeader,
      },
      body: JSON.stringify(input),
    });
    if (!finalRes.ok) {
      const text = await finalRes.text();
      return errorResult({
        error: "action_failed_after_payment",
        status: finalRes.status,
        body_preview: text.slice(0, 500),
        preimage_used: paid.preimage,
        token_used: challenge.token.slice(0, 40) + "…",
      });
    }
    const responseJson = (await finalRes.json()) as {
      output: unknown;
      receipt: {
        receipt_id: string;
        action_id: string;
        amount_msats: number;
        payment_hash: string;
        input_hash: string;
        output_hash: string;
        completed_at: string;
        service_pubkey: string;
        signature: string;
      };
    };

    // Step 4: store receipt locally.
    recordReceipt({
      receipt_id: responseJson.receipt.receipt_id,
      domain,
      action_id,
      amount_msats: responseJson.receipt.amount_msats,
      payment_hash: responseJson.receipt.payment_hash,
      preimage: paid.preimage,
      input_json: JSON.stringify(input),
      output_json: JSON.stringify(responseJson.output),
      service_pubkey: responseJson.receipt.service_pubkey,
      service_signature: responseJson.receipt.signature,
      completed_at: responseJson.receipt.completed_at,
    });

    log(`paid ${action.price_msats} msats to ${domain}/${action_id} → receipt ${responseJson.receipt.receipt_id}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "paid",
              action_id,
              domain,
              amount_msats: action.price_msats,
              amount_sats: action.price_msats / 1000,
              fees_paid_msats: paid.fees_paid_msats,
              purpose,
              policy_decision: decision,
              output: responseJson.output,
              receipt: responseJson.receipt,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ------------------------------------------------------------------
// spend_summary
// ------------------------------------------------------------------
server.tool(
  "spend_summary",
  "Show today's (or this week's) Lightning spend, organized by domain. Useful for the user's audit trail and for the agent to know its remaining budget.",
  {
    period: z.enum(["today", "week", "all"]).default("today"),
    include_balance: z
      .boolean()
      .default(false)
      .describe("If true, also queries the agent wallet's current balance via NWC."),
  },
  async ({ period, include_balance }) => {
    const policy = loadPolicy();
    const summary = spendSummary(period);
    const remaining =
      period === "today"
        ? Math.max(0, policy.daily_budget_msats - summary.total_msats)
        : null;
    let balance_msats: number | null = null;
    if (include_balance) {
      try {
        balance_msats = (await getBalance()).balance_msats;
      } catch (e: unknown) {
        balance_msats = null;
        log(`get_balance failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              period,
              total_spent_msats: summary.total_msats,
              total_spent_sats: summary.total_msats / 1000,
              call_count: summary.count,
              by_domain: summary.by_domain,
              recent: summary.recent,
              policy_daily_budget_msats: policy.daily_budget_msats,
              remaining_today_msats: remaining,
              wallet_balance_msats: balance_msats,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

function errorResult(payload: object) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
log("tollgate-mcp ready");

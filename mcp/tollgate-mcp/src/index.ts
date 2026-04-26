#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchManifest, domainOf, manifestUrlFor, ManifestAction } from "./manifest-client.js";
import { evaluate, loadPolicy } from "./policy.js";
import {
  isKnownService,
  recordReceipt,
  spendSummary,
  todaysSpendMsats,
  getStoredReceipt,
  recordFeedbackPublished,
  getCachedReputation,
  putCachedReputation,
  getCachedRaterDiversity,
  putCachedRaterDiversity,
} from "./db.js";
import { parseChallengeFromResponse, buildAuthorizationHeader } from "./l402-client.js";
import { payInvoice, getBalance } from "./wallet.js";
import {
  getAgentNostrKey,
  buildFeedbackTemplate,
  signEvent,
  publishToRelays,
  fetchFeedbackEvents,
  fetchRaterHistory,
  verifyFeedbackEvent,
  aggregateReputation,
  getRelays,
  closePool,
  type Receipt,
  type VerifiedFeedback,
} from "./nostr.js";

const server = new McpServer({ name: "tollgate", version: "0.1.0" });

const log = (...args: unknown[]) => {
  process.stderr.write(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ") + "\n");
};

/**
 * Build a {rater → distinct_services} map for the given verified feedback set,
 * using the cache where available and fetching missing entries in parallel.
 */
async function getRaterDiversities(
  feedbacks: VerifiedFeedback[],
): Promise<Record<string, number>> {
  const unique = new Set(feedbacks.map((f) => f.rater_pubkey));
  const out: Record<string, number> = {};
  const toFetch: string[] = [];
  for (const pk of unique) {
    const cached = getCachedRaterDiversity(pk);
    if (cached) out[pk] = cached.distinct_services;
    else toFetch.push(pk);
  }
  if (toFetch.length === 0) return out;
  await Promise.allSettled(
    toFetch.map(async (pk) => {
      const h = await fetchRaterHistory({ raterPubkey: pk, timeoutMs: 3500 });
      if (h) {
        out[pk] = h.distinct_services;
        putCachedRaterDiversity({
          rater_pubkey: pk,
          distinct_services: h.distinct_services,
          total_ratings: h.total_ratings,
        });
      }
      // On failure, leave undefined; aggregator falls back to default.
    }),
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* discover                                                            */
/* ------------------------------------------------------------------ */
server.tool(
  "discover",
  "Look up a Tollgate manifest for a URL or domain. Returns the list of paid actions a site offers, with prices, risk levels, and decentralized network reputation if available. Call this BEFORE pay_and_invoke whenever you encounter a new site or want to see what's available.",
  {
    url: z.string().describe("A URL or domain (e.g. example.com or https://example.com/article)."),
    fetch_network_reputation: z
      .boolean()
      .default(true)
      .describe("If true, query Nostr relays for the site's reputation (cached 5 minutes). Disable for repeated lookups."),
  },
  async ({ url, fetch_network_reputation }) => {
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
    const servicePubkey = manifest.receipts.pubkey_hex;

    const policy = loadPolicy();
    let networkReputation: unknown = { available: false };
    if (fetch_network_reputation) {
      try {
        const cached = getCachedReputation(servicePubkey);
        if (cached) {
          networkReputation = { available: true, cached: true, ...cached.summary };
        } else {
          const events = await fetchFeedbackEvents({ servicePubkeyHex: servicePubkey, timeoutMs: 3500 });
          const verified = events
            .map(verifyFeedbackEvent)
            .filter((v): v is NonNullable<typeof v> => v !== null);
          const raterDistinctServices = await getRaterDiversities(verified);
          const summary = aggregateReputation(verified, {
            service_pubkey: servicePubkey,
            domain,
            raterDistinctServices,
            minDistinctServicesToCount: policy.rater_min_distinct_services,
            fullWeightAtDistinctServices: policy.rater_full_weight_at_distinct_services,
          });
          putCachedReputation({ service_pubkey: servicePubkey, domain, summary });
          networkReputation = { available: true, cached: false, ...summary };
        }
      } catch (e: unknown) {
        networkReputation = { available: false, error: e instanceof Error ? e.message : String(e) };
      }
    }

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
              network_reputation: networkReputation,
              receipts_pubkey: servicePubkey,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

/* ------------------------------------------------------------------ */
/* pay_and_invoke                                                      */
/* ------------------------------------------------------------------ */
server.tool(
  "pay_and_invoke",
  "Atomically: fetch a paid action, pay the L402 challenge under deterministic policy, return the result + receipt. ALWAYS prefer this over any direct fetch. Policy is enforced in code, not via the model — if the call would exceed budget, violate policy, or fall below the network-reputation threshold, this tool refuses. The receipt is bound to the agent's Nostr identity so feedback can be published later.",
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

    // Pull cached network reputation if any (don't block on a fresh fetch in the hot path).
    let networkRep: { weighted_score: number; sample_size: number } | null = null;
    const cached = getCachedReputation(manifest.receipts.pubkey_hex);
    if (cached?.summary && typeof (cached.summary as { weighted_score?: number }).weighted_score === "number") {
      const s = cached.summary as { weighted_score: number; sample_size: number };
      if (Number.isFinite(s.weighted_score)) networkRep = s;
    }

    const decision = evaluate({
      policy,
      action_type: action.type,
      amount_msats: action.price_msats,
      domain,
      todays_spend_msats: todaysSpend,
      is_known_service: isKnownService(domain),
      network_reputation: networkRep,
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

    // Agent's persistent Nostr identity — allows publishing verifiable feedback later.
    const agentKey = getAgentNostrKey();

    // Step 1: trigger 402 challenge.
    const challengeRes = await fetch(action.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tollgate-buyer-pubkey": agentKey.publicKey,
      },
      body: JSON.stringify(input),
    });
    if (challengeRes.status !== 402) {
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
        "x-tollgate-buyer-pubkey": agentKey.publicKey,
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
      receipt: Receipt;
    };

    // Step 4: store receipt locally (with full receipt JSON for later feedback publish).
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
      buyer_pubkey: responseJson.receipt.buyer_pubkey ?? agentKey.publicKey,
      receipt_json: JSON.stringify(responseJson.receipt),
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
              feedback_hint:
                "After using this output, call publish_feedback({ receipt_id, score }) to add a verifiable score (0–1) to the network reputation graph for this service. Optional but encouraged.",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

/* ------------------------------------------------------------------ */
/* publish_feedback                                                    */
/* ------------------------------------------------------------------ */
server.tool(
  "publish_feedback",
  "Publish a verifiable Nostr feedback event (kind 30402) rating a paid action you previously made. The score (0-1) is anchored to the receipt the publisher signed and to your agent's Nostr identity, so the network can compute weighted reputation: Σ(amount × score) / Σ(amount). Optional but encouraged after every paid action.",
  {
    receipt_id: z.string().describe("The receipt_id from a previous pay_and_invoke. Must reference a receipt in the local store."),
    score: z
      .number()
      .min(0)
      .max(1)
      .describe("Quality score, 0 (useless) to 1 (perfectly useful). Higher means you'd pay this service for this action again."),
    note: z.string().max(280).optional().describe("Optional short freeform note. Public; do not include sensitive data."),
  },
  async ({ receipt_id, score, note }) => {
    const stored = getStoredReceipt(receipt_id);
    if (!stored) {
      return errorResult({ error: "receipt_not_found", receipt_id });
    }
    if (!stored.receipt_json) {
      return errorResult({
        error: "receipt_missing_canonical_form",
        receipt_id,
        hint: "This receipt predates Nostr feedback support. Pay for a new action and rate that one.",
      });
    }
    const agentKey = getAgentNostrKey();
    if (stored.buyer_pubkey && stored.buyer_pubkey !== agentKey.publicKey) {
      return errorResult({
        error: "buyer_mismatch",
        hint: "This receipt was paid for by a different agent identity (perhaps an older one). Only the buyer can publish feedback.",
        receipt_buyer: stored.buyer_pubkey,
        agent: agentKey.publicKey,
      });
    }
    let receipt: Receipt;
    try {
      receipt = JSON.parse(stored.receipt_json);
    } catch {
      return errorResult({ error: "receipt_parse_failed", receipt_id });
    }
    if (!receipt.buyer_pubkey) {
      // Older publisher didn't include buyer_pubkey in the signed core; we can't
      // produce a verifiable feedback event because verifiers will require it.
      return errorResult({
        error: "receipt_missing_buyer_pubkey",
        hint: "The publisher didn't bind your agent identity into this receipt. Pay for a new action with a publisher that supports x-tollgate-buyer-pubkey.",
      });
    }

    const template = buildFeedbackTemplate({
      receipt,
      domain: stored.domain,
      score,
      note,
    });
    const event = signEvent(template, agentKey.secretKey);
    const { accepted, rejected } = await publishToRelays(event);

    if (accepted.length === 0) {
      return errorResult({
        error: "no_relays_accepted",
        rejected,
        relays_attempted: getRelays(),
      });
    }

    recordFeedbackPublished({
      receipt_id,
      domain: stored.domain,
      service_pubkey: stored.service_pubkey,
      score,
      event_id: event.id,
      relays_accepted: accepted,
    });

    // Invalidate cached reputation for this service so the new event is included next time.
    putCachedReputation({
      service_pubkey: stored.service_pubkey,
      domain: stored.domain,
      summary: { invalidated: true },
    });

    log(`published feedback ${event.id} score=${score} → ${accepted.length}/${accepted.length + rejected.length} relays`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "published",
              event_id: event.id,
              kind: event.kind,
              receipt_id,
              service_pubkey: stored.service_pubkey,
              domain: stored.domain,
              score,
              note,
              relays_accepted: accepted,
              relays_rejected: rejected,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

/* ------------------------------------------------------------------ */
/* get_reputation                                                      */
/* ------------------------------------------------------------------ */
server.tool(
  "get_reputation",
  "Fetch + verify Nostr feedback events for a service and compute its weighted reputation: Σ(amount_msats × score) / Σ(amount_msats). Validates each event's signature, verifies the embedded receipt, and only counts feedback from agents who actually paid the publisher. Cached 5 minutes.",
  {
    url: z
      .string()
      .optional()
      .describe("Site URL or domain — we look up its service_pubkey via the manifest."),
    service_pubkey: z
      .string()
      .optional()
      .describe("Hex-encoded service public key. If both url and service_pubkey are given, service_pubkey wins."),
    bypass_cache: z.boolean().default(false),
  },
  async ({ url, service_pubkey, bypass_cache }) => {
    let svcPubkey = service_pubkey;
    let domain = "";
    if (url) {
      const m = await fetchManifest(url);
      if (m) {
        svcPubkey ??= m.receipts.pubkey_hex;
        domain = domainOf(url);
      }
    }
    if (!svcPubkey) {
      return errorResult({
        error: "missing_service_pubkey",
        hint: "Provide either url (we'll fetch the manifest) or service_pubkey directly.",
      });
    }

    if (!bypass_cache) {
      const cached = getCachedReputation(svcPubkey);
      if (cached && (cached.summary as { invalidated?: boolean }).invalidated !== true) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ cached: true, ...cached.summary }, null, 2),
            },
          ],
        };
      }
    }

    const policy = loadPolicy();
    const events = await fetchFeedbackEvents({ servicePubkeyHex: svcPubkey, timeoutMs: 5000 });
    const verified = events
      .map(verifyFeedbackEvent)
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const raterDistinctServices = await getRaterDiversities(verified);
    const summary = aggregateReputation(verified, {
      service_pubkey: svcPubkey,
      domain,
      raterDistinctServices,
      minDistinctServicesToCount: policy.rater_min_distinct_services,
      fullWeightAtDistinctServices: policy.rater_full_weight_at_distinct_services,
    });
    putCachedReputation({ service_pubkey: svcPubkey, domain, summary });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              cached: false,
              ...summary,
              relays: getRelays(),
              raw_event_count: events.length,
              verified_event_count: verified.length,
              dropped_count: events.length - verified.length,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

/* ------------------------------------------------------------------ */
/* spend_summary                                                       */
/* ------------------------------------------------------------------ */
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
    const agentKey = getAgentNostrKey();
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
              agent_nostr_pubkey: agentKey.publicKey,
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

// Graceful shutdown closes Nostr relay connections.
process.on("SIGINT", () => { closePool(); process.exit(0); });
process.on("SIGTERM", () => { closePool(); process.exit(0); });

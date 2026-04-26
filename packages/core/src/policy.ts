import { z } from "zod";
import { ActionTypeSchema } from "./manifest.js";

export const SpendPolicySchema = z.object({
  version: z.literal("0.1").default("0.1"),
  daily_budget_msats: z.number().int().nonnegative().default(50_000),
  max_per_action_msats: z.number().int().nonnegative().default(10_000),
  require_confirm_above_msats: z.number().int().nonnegative().default(5_000),
  allowed_action_types: z
    .array(ActionTypeSchema)
    .default(["web_access", "structured_data", "site_agent_query", "verification"]),
  blocked_domains: z.array(z.string()).default([]),
  trusted_domains: z.array(z.string()).default([]),
  new_service_max_msats: z.number().int().nonnegative().default(2_000),
  // Network reputation gates (only fire when network reputation data is present)
  min_network_reputation: z.number().min(0).max(1).default(0),
  min_reputation_sample_size: z.number().int().nonnegative().default(0),
  rater_min_distinct_services: z.number().int().nonnegative().default(1),
  rater_full_weight_at_distinct_services: z.number().int().positive().default(3),
});
export type SpendPolicy = z.infer<typeof SpendPolicySchema>;

export type PolicyDecision =
  | { decision: "allow"; reason: string }
  | { decision: "deny"; reason: string }
  | { decision: "needs_human_approval"; reason: string };

/**
 * Pure policy evaluation. No I/O, no clock — caller passes spent-today and
 * is_known_service. Lets the same routine run server-side, MCP-side, or
 * client-side (e.g. the web wallet's "what would happen if?" preview).
 */
export function evaluateSpendPolicy(opts: {
  policy: SpendPolicy;
  action_type: string;
  amount_msats: number;
  domain: string;
  todays_spend_msats: number;
  is_known_service: boolean;
  network_reputation?: { weighted_score: number; sample_size: number } | null;
}): PolicyDecision {
  const {
    policy,
    action_type,
    amount_msats,
    domain,
    todays_spend_msats,
    is_known_service,
    network_reputation,
  } = opts;

  if (policy.blocked_domains.includes(domain)) {
    return { decision: "deny", reason: `domain ${domain} is on the blocklist` };
  }
  if (!policy.allowed_action_types.includes(action_type as never)) {
    return {
      decision: "deny",
      reason: `action_type "${action_type}" not in allowed_action_types ${JSON.stringify(policy.allowed_action_types)}`,
    };
  }
  if (amount_msats > policy.max_per_action_msats) {
    return {
      decision: "deny",
      reason: `amount ${amount_msats} msats exceeds max_per_action_msats ${policy.max_per_action_msats}`,
    };
  }
  if (todays_spend_msats + amount_msats > policy.daily_budget_msats) {
    return {
      decision: "deny",
      reason: `would exceed daily_budget_msats ${policy.daily_budget_msats} (already spent ${todays_spend_msats}, adding ${amount_msats})`,
    };
  }
  if (!is_known_service && amount_msats > policy.new_service_max_msats) {
    return {
      decision: "deny",
      reason: `service ${domain} has no prior receipts; new_service_max_msats is ${policy.new_service_max_msats}`,
    };
  }
  if (
    policy.min_network_reputation > 0 &&
    network_reputation &&
    network_reputation.sample_size >= policy.min_reputation_sample_size &&
    Number.isFinite(network_reputation.weighted_score) &&
    network_reputation.weighted_score < policy.min_network_reputation &&
    !policy.trusted_domains.includes(domain)
  ) {
    return {
      decision: "deny",
      reason: `network reputation ${network_reputation.weighted_score.toFixed(2)} (n=${network_reputation.sample_size}) below min_network_reputation ${policy.min_network_reputation}`,
    };
  }
  if (
    amount_msats > policy.require_confirm_above_msats &&
    !policy.trusted_domains.includes(domain)
  ) {
    return {
      decision: "needs_human_approval",
      reason: `amount ${amount_msats} msats exceeds require_confirm_above_msats ${policy.require_confirm_above_msats}; domain not in trusted list`,
    };
  }
  return {
    decision: "allow",
    reason: `within all limits (action_type=${action_type}, amount=${amount_msats} msats, domain=${domain})`,
  };
}

export const DEFAULT_POLICY: SpendPolicy = SpendPolicySchema.parse({});

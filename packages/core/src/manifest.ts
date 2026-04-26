import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Action types                                                       */
/* ------------------------------------------------------------------ */

export const ACTION_TYPES = [
  "web_access",
  "structured_data",
  "site_agent_query",
  "verification",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export const ActionTypeSchema = z.enum(ACTION_TYPES);

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export const RiskLevelSchema = z.enum(RISK_LEVELS);

/* ------------------------------------------------------------------ */
/* PaidAction                                                         */
/* ------------------------------------------------------------------ */

export const PaidActionSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z][a-z0-9_.-]*$/, "lowercase, dot-separated"),
  type: ActionTypeSchema,
  title: z.string().max(256).optional(),
  description: z.string().max(1024).optional(),
  endpoint: z.string().url(),
  method: z.literal("POST").default("POST"),
  price_msats: z.number().int().nonnegative().max(1_000_000_000),
  input_schema: z.record(z.string(), z.unknown()).optional(),
  risk: RiskLevelSchema.default("low"),
});
export type PaidAction = z.infer<typeof PaidActionSchema>;

/* ------------------------------------------------------------------ */
/* Manifest                                                           */
/* ------------------------------------------------------------------ */

export const ManifestSchema = z.object({
  version: z.literal("0.1"),
  service: z.object({
    name: z.string().max(256),
    description: z.string().max(1024).optional(),
    homepage: z.string().url(),
    lightning_address: z.string().max(256).optional(),
  }),
  actions: z.array(PaidActionSchema).min(1),
  receipts: z.object({
    pubkey_hex: z.string().regex(/^[0-9a-f]+$/, "lowercase hex"),
    algorithm: z.literal("ed25519"),
  }),
});
export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * Path the manifest MUST be served at.
 */
export const MANIFEST_PATH = "/.well-known/agents402.json" as const;

/**
 * Build the canonical manifest URL for a given site URL or domain.
 */
export function manifestUrlFor(input: string): string {
  const u = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
  return `${u.protocol}//${u.host}${MANIFEST_PATH}`;
}

export function domainOf(input: string): string {
  return new URL(/^https?:\/\//.test(input) ? input : `https://${input}`).host;
}

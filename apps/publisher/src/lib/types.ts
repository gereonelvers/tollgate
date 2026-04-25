import { z } from "zod";

export const ManifestActionSchema = z.object({
  id: z.string(),
  type: z.enum(["web_access", "structured_data", "site_agent_query", "verification"]),
  title: z.string(),
  description: z.string(),
  endpoint: z.string(),
  method: z.literal("POST"),
  price_msats: z.number().int().nonnegative(),
  input_schema: z.record(z.string(), z.unknown()).optional(),
  risk: z.enum(["low", "medium", "high"]).default("low"),
});
export type ManifestAction = z.infer<typeof ManifestActionSchema>;

export const ManifestSchema = z.object({
  version: z.literal("0.1"),
  service: z.object({
    name: z.string(),
    description: z.string(),
    homepage: z.string(),
    lightning_address: z.string().optional(),
  }),
  actions: z.array(ManifestActionSchema),
  receipts: z.object({
    pubkey_hex: z.string(),
    algorithm: z.literal("ed25519"),
  }),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const ReceiptSchema = z.object({
  receipt_id: z.string(),
  action_id: z.string(),
  amount_msats: z.number().int().nonnegative(),
  payment_hash: z.string(),
  input_hash: z.string(),
  output_hash: z.string(),
  completed_at: z.string(),
  service_pubkey: z.string(),
  signature: z.string(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

export const SiteAgentInputSchema = z.object({
  question: z.string().min(1).max(500),
});
export type SiteAgentInput = z.infer<typeof SiteAgentInputSchema>;

export const ExtractInputSchema = z.object({
  doc_id: z.string().min(1),
});
export type ExtractInput = z.infer<typeof ExtractInputSchema>;

import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Receipt                                                            */
/* ------------------------------------------------------------------ */

export const RECEIPT_CORE_KEYS = [
  "action_id",
  "amount_msats",
  "buyer_pubkey",
  "completed_at",
  "input_hash",
  "output_hash",
  "payment_hash",
  "receipt_id",
  "service_pubkey",
] as const;
export type ReceiptCoreKey = (typeof RECEIPT_CORE_KEYS)[number];

export const ReceiptCoreSchema = z.object({
  receipt_id: z.string().regex(/^rcpt_[A-Za-z0-9_-]+$/),
  action_id: z.string(),
  amount_msats: z.number().int().nonnegative(),
  buyer_pubkey: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  payment_hash: z.string().regex(/^[0-9a-f]{64}$/),
  input_hash: z.string().regex(/^[0-9a-f]{64}$/),
  output_hash: z.string().regex(/^[0-9a-f]{64}$/),
  completed_at: z.string(),
  service_pubkey: z.string().regex(/^[0-9a-f]+$/),
});
export type ReceiptCore = z.infer<typeof ReceiptCoreSchema>;

export const ReceiptSchema = ReceiptCoreSchema.extend({
  signature: z.string().regex(/^[0-9a-f]+$/),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

/**
 * Canonical JSON form for hashing/signing/verifying receipts.
 *
 * Rules:
 *   - keys appear in the fixed alphabetical order defined by RECEIPT_CORE_KEYS
 *   - absent optional fields are omitted entirely (they don't appear in the
 *     output, not even as null)
 *   - no insignificant whitespace, UTF-8
 *
 * Implementations on both the publisher (signing) and aggregator (verifying)
 * sides MUST use this exact routine. Adding a new optional field never
 * invalidates older signatures because the present-keys list is computed at
 * canonicalization time.
 */
export function canonicalReceiptCore(r: ReceiptCore): string {
  const present = RECEIPT_CORE_KEYS.filter((k) => r[k] !== undefined);
  return JSON.stringify(r, present as unknown as string[]);
}

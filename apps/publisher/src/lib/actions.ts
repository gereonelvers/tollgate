import crypto from "node:crypto";
import { z } from "zod";
import { ManifestAction, SiteAgentInputSchema, ExtractInputSchema } from "./types";
import { findDoc } from "./corpus";
import { answer } from "./site_agent";

export type ActionHandlerResult = {
  output: unknown;
  output_text_for_hash: string;
};

export type ActionDefinition = {
  manifest: ManifestAction;
  inputSchema: z.ZodType;
  handler: (input: unknown) => Promise<ActionHandlerResult>;
};

const PUBLISHER_BASE =
  process.env.PUBLISHER_BASE_URL || "http://localhost:3000";

export const ACTIONS: Record<string, ActionDefinition> = {
  "ask.site_agent": {
    manifest: {
      id: "ask.site_agent",
      type: "site_agent_query",
      title: "Ask the site agent",
      description:
        "A question-answering endpoint over the publisher's archive. Returns a cited answer drawn only from the publisher's documents.",
      endpoint: `${PUBLISHER_BASE}/api/actions/ask.site_agent`,
      method: "POST",
      price_msats: 3000,
      input_schema: {
        type: "object",
        properties: {
          question: { type: "string", maxLength: 500 },
        },
        required: ["question"],
      },
      risk: "low",
    },
    inputSchema: SiteAgentInputSchema,
    handler: async (input) => {
      const { question } = SiteAgentInputSchema.parse(input);
      const result = await answer(question);
      return {
        output: result,
        output_text_for_hash: JSON.stringify(result),
      };
    },
  },
  "extract.structured": {
    manifest: {
      id: "extract.structured",
      type: "structured_data",
      title: "Structured document extraction",
      description:
        "Returns clean structured JSON for a single document by id: title, author, date, summary, key_claims.",
      endpoint: `${PUBLISHER_BASE}/api/actions/extract.structured`,
      method: "POST",
      price_msats: 1000,
      input_schema: {
        type: "object",
        properties: { doc_id: { type: "string" } },
        required: ["doc_id"],
      },
      risk: "low",
    },
    inputSchema: ExtractInputSchema,
    handler: async (input) => {
      const { doc_id } = ExtractInputSchema.parse(input);
      const doc = findDoc(doc_id);
      if (!doc) {
        const err = { error: "doc_not_found", doc_id };
        return { output: err, output_text_for_hash: JSON.stringify(err) };
      }
      const sentences = doc.body.split(/(?<=[.!?])\s+/).filter(Boolean);
      const summary = sentences.slice(0, 2).join(" ");
      const out = {
        doc_id: doc.id,
        title: doc.title,
        author: doc.author,
        date: doc.date,
        summary,
        key_claims: sentences
          .filter((s) => s.length > 60 && s.length < 240)
          .slice(0, 5),
        word_count: doc.body.split(/\s+/).length,
      };
      return { output: out, output_text_for_hash: JSON.stringify(out) };
    },
  },
};

export function getAction(id: string): ActionDefinition | null {
  return ACTIONS[id] ?? null;
}

export function listActions(): ManifestAction[] {
  return Object.values(ACTIONS).map((a) => a.manifest);
}

export function hashInput(payload: unknown): string {
  const canonical = JSON.stringify(payload);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function hashOutput(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

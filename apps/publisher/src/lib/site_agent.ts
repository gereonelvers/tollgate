import Anthropic from "@anthropic-ai/sdk";
import { CORPUS, searchDocs } from "./corpus";

const SYSTEM_PROMPT = `You are the site agent for a publication that hosts essays about Bitcoin, Lightning, AI agents, and the economics of paid web access. Answer questions only using the provided source documents. Always cite the doc_id of any document you draw from. If the answer isn't in the corpus, say so honestly. Keep answers concise — 4-6 sentences and a citation list.`;

function buildContext(query: string): string {
  const docs = searchDocs(query, 3);
  return docs
    .map(
      (d) => `<doc id="${d.id}" title="${d.title}" author="${d.author}" date="${d.date}">
${d.body}
</doc>`,
    )
    .join("\n\n");
}

export type SiteAgentAnswer = {
  answer: string;
  citations: Array<{ doc_id: string; title: string }>;
  used_llm: boolean;
};

export async function answer(question: string): Promise<SiteAgentAnswer> {
  const docs = searchDocs(question, 3);
  const citations = docs.map((d) => ({ doc_id: d.id, title: d.title }));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: deterministic snippet-based answer when no LLM key is configured.
    if (docs.length === 0) {
      return {
        answer: "No documents in the corpus matched that question.",
        citations: [],
        used_llm: false,
      };
    }
    const top = docs[0];
    const lead = top.body.split("\n\n")[0].slice(0, 360);
    return {
      answer: `From "${top.title}" (${top.author}, ${top.date}): ${lead}`,
      citations,
      used_llm: false,
    };
  }

  const client = new Anthropic({ apiKey });
  const context = buildContext(question);
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `Source documents:\n\n${context}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: question }],
  });
  const text =
    msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n") || "(no answer)";
  return { answer: text, citations, used_llm: true };
}

export function listDocs() {
  return CORPUS.map((d) => ({ id: d.id, title: d.title, author: d.author, date: d.date }));
}

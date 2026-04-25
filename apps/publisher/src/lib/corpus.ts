export type Doc = {
  id: string;
  title: string;
  author: string;
  date: string;
  body: string;
};

// Demo corpus — pretend this is the publisher's full archive.
// Picked Bitcoin/Lightning topics so the demo has thematically relevant content.
export const CORPUS: Doc[] = [
  {
    id: "doc.lightning_economics_2026",
    title: "Why micropayments finally work in 2026",
    author: "Asha Patel",
    date: "2026-03-14",
    body: `For two decades, "micropayments will change everything" was a punchline. Card rails couldn't carry a one-cent transaction without losing money on every fee. App stores took 30%. Stripe's minimum was 50 cents.

The Lightning Network changed the math. A 1-sat (≈$0.0006) payment routes in under a second across borders for a fee that's frequently zero. The economic floor of "what's worth charging for" collapsed. A page view, a paragraph, a model inference, a verification — all become priceable.

But humans never wanted to micropay. We wanted Netflix subscriptions and "free with ads." Micropayments were a solution waiting for the right customer. That customer turned out to be agents.

An agent doing research has no problem paying 3 sats for clean structured data versus scraping. Fifty paid actions across a research task costs less than a stamp. The agent doesn't suffer micro-decision fatigue, doesn't care about loyalty programs, doesn't need branded checkout. Lightning fits agent economics the way fiber-optic cable fits 4K streaming: the rail finally matches the consumer.`,
  },
  {
    id: "doc.scraping_is_dying",
    title: "The end of free scraping",
    author: "Marko Vidović",
    date: "2026-02-28",
    body: `Three things broke the implicit "let bots crawl, monetize humans with ads" deal: (1) ad-supported business models cratered as ChatGPT-style answer engines disintermediated clicks, (2) compute costs of AI training made unauthorized scraping a measurable line item for victims, (3) Cloudflare's pay-per-crawl and similar primitives made charging crawlers a one-checkbox option.

Publishers now have a real choice: block, license, or sell per-action. Blocking shrinks reach. Licensing only works for the top dozen content businesses. Selling per-action — page-by-page, query-by-query — is the long tail's option, and it's the only one that scales without a sales team.

The Tollgate primitive (paid-action manifests at /.well-known/tollgate.json) is the smallest change a website can make to enter this market. The site declares what's for sale and at what price; Lightning handles the settlement. No accounts, no contracts, no marketplaces taking 30%.`,
  },
  {
    id: "doc.agent_reputation",
    title: "Receipts, not reputations",
    author: "Lin Chen",
    date: "2026-04-09",
    body: `Every reputation system that's tried to be a global score has failed. Yelp, Trustpilot, eBay's stars — they degrade into spam, gaming, or controlled by a single company that becomes the gatekeeper everyone wanted to avoid.

For agents, the right primitive is signed receipts. Each paid action creates a small artifact: who served it, what was bought, what hash of the input, what hash of the output, what amount, signed by the service. Receipts compose. An agent's local trust scoring layer can weigh recent receipts from peers it trusts more than ancient receipts from strangers — task-specific, time-sensitive, sybil-resistant via the underlying cost of payment.

Trust then is not a number on a service's profile. It is a portable evidence trail that any agent can audit for the questions it cares about: "Has this service answered questions like mine reliably for buyers I trust?" Lightning makes this practical because the cost of producing a signed paid-action receipt is real bitcoin — fakery has economic friction.`,
  },
];

export function findDoc(id: string): Doc | undefined {
  return CORPUS.find((d) => d.id === id);
}

export function searchDocs(query: string, limit = 3): Doc[] {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = CORPUS.map((d) => {
    const text = `${d.title} ${d.body}`.toLowerCase();
    const score = tokens.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
    return { d, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.d);
}

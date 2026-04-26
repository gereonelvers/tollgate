# Faregate

**Paid actions for the agent web, settled instantly over Lightning.**

Faregate is the reference implementation of [**agents402**](https://agents402.org) (A402) — a tiny protocol that lets AI agents discover and buy fine-grained capabilities from websites (page access, structured extraction, site-agent answers, human verification) for sub-cent prices over Lightning. Every paid call returns a portable, ed25519-signed receipt.

Built for [Hack-Nation × Spiral](https://spiral.xyz) "Earn in the Agent Economy" — 2026.

## Public sites

| URL | What it is | Source |
| --- | --- | --- |
| [**agents402.org**](https://agents402.org) | The open protocol — spec, concepts, conformance, examples | `apps/protocol-site` |
| [**faregate.org**](https://faregate.org) | Corporate / marketing site — what Faregate sells to publishers | `apps/corporate-site` |
| [**wallet.faregate.org**](https://wallet.faregate.org) | Browser-pairing flow for agents to create a Spark wallet | `apps/web` |

## Repo layout

```
tollgate/
├── apps/
│   ├── publisher/        Next.js demo publisher: manifest, paid actions, dashboard
│   ├── verifier/         Single-file Node.js second paid service (agent-to-agent demo)
│   ├── protocol-site/    agents402.org — protocol spec & docs
│   ├── corporate-site/   faregate.org — marketing site
│   └── web/              wallet.faregate.org — agent wallet setup
├── mcp/tollgate-mcp/     MCP server: discover, pay_and_invoke, get_reputation, …
├── skill/faregate/       Claude Skill teaching the agent when/how to use the MCP tools
├── packages/             Shared core: manifest, policy, wallet, receipt, CLI
├── scripts/test-flow.mjs End-to-end smoke test (no Claude required)
├── .mcp.json             MCP config (auto-loaded by Claude Code from project root)
└── policy.example.json   Example agent spending policy
```

## The 30-second story

A site declares what it sells in a JSON file at `/.well-known/agents402.json`:

```json
{
  "version": "0.1",
  "service": { "name": "Example Pub", "homepage": "https://example.com" },
  "actions": [
    { "id": "ask.site_agent",     "type": "site_agent_query",  "price_msats": 3000, "endpoint": "..." },
    { "id": "extract.structured", "type": "structured_data",   "price_msats": 1000, "endpoint": "..." }
  ],
  "receipts": { "pubkey_hex": "...", "algorithm": "ed25519" }
}
```

An agent (Claude Code with the Faregate Skill) sees a URL, calls `discover`, picks an action, and hands off to `pay_and_invoke`. The MCP server:

1. Fetches the action endpoint → gets `402 Payment Required` + L402 invoice.
2. Checks deterministic policy (daily budget, per-action cap, allowed types).
3. Pays the invoice via NWC.
4. Retries with `Authorization: L402 <token>:<preimage>`.
5. Stores the signed receipt locally.

The model never holds wallet secrets and never approves its own spend.

## Quickstart

**Prerequisites:** Node 20+, an [Alby](https://getalby.com) account with ~5,000 sats, and an NWC URI with `pay_invoice`, `make_invoice`, `lookup_invoice`, `get_balance` scopes.

```bash
# install
cd apps/publisher && npm install
cd ../../mcp/tollgate-mcp && npm install && npm run build

# configure publisher
cd ../../apps/publisher
cp .env.local.example .env.local   # set PUBLISHER_NWC_URL, PUBLISHER_BASE_URL, L402_SECRET, ANTHROPIC_API_KEY

# run
npm run dev
# → http://localhost:3000               (landing)
# → http://localhost:3000/dashboard     (live SSE feed)
# → http://localhost:3000/.well-known/agents402.json
```

For the agent side, set `AGENT_NWC_URL` before launching Claude Code. The two URIs can be the same Alby connection for a v1 demo (you pay yourself); two separate accounts make a more authentic demo.

**No real Lightning?** `FAREGATE_MOCK_LIGHTNING=1` swaps in synthetic invoices the dashboard clearly badges as `MOCK LIGHTNING`. Same wire format end-to-end.

**Agent-to-agent demo:** in a second terminal, `cd apps/verifier && VERIFIER_NWC_URL=… npm run dev` (port 3010). The agent can then pay the publisher 3 sats for an answer and the verifier 5 sats to fact-check it.

**Try a paid call** in Claude Code (from the `tollgate/` directory):

> Use Faregate on http://localhost:3000 to ask the site agent why micropayments now make sense for agents but never did for humans. Budget: 10 sats.

## Wire format

```
POST /api/actions/ask.site_agent
Content-Type: application/json
{ "question": "..." }

← 402 Payment Required
  WWW-Authenticate: L402 macaroon="<base64>", invoice="lnbc..."
  { "amount_msats": 3000, "invoice": "...", "token": "...", "payment_hash": "..." }

# agent pays via NWC

POST /api/actions/ask.site_agent
Authorization: L402 <token>:<preimage>

← 200 OK
  { "output": { ... }, "receipt": { "receipt_id": "...", "signature": "..." } }
```

The token binds `(payment_hash, scope, expiry)` under HMAC. Verification is purely cryptographic on the server: `sha256(preimage) == payment_hash` ∧ token signature valid ∧ scope matches `(action_id, hash(input))` ∧ not consumed. **No Lightning node access is needed at verify time** — paid status is provable from the preimage alone.

## Policy

The MCP server enforces a deterministic policy file (default `~/.faregate/policy.json`, override via `FAREGATE_POLICY_PATH`). Decisions happen *before* payment:

- `daily_budget_msats`, `max_per_action_msats`, `require_confirm_above_msats`
- `allowed_action_types`, `blocked_domains` / `trusted_domains`
- `new_service_max_msats` — first-time spend cap with unknown services

The model's reasoning is **never** part of the spend decision. Failure modes from prompt injection or model drift are mitigated by code, not trust.

## Receipts & reputation

Every paid action returns an ed25519-signed JSON receipt over `{action_id, amount, payment_hash, input_hash, output_hash, completed_at, service_pubkey}`. Receipts are stored locally (agent: `~/.faregate/agent.db`; publisher: `apps/publisher/data/faregate.db`) and can be published as Nostr events for portable, rater-diversity-weighted reputation — see the MCP `publish_feedback` / `get_reputation` tools.

## More

- [`demo/script.md`](demo/script.md) — 90-second walkthrough script
- [`DEPLOY.md`](DEPLOY.md) — Railway deployment for the two marketing sites
- [`policy.example.json`](policy.example.json) — annotated example policy
- [`mcp/tollgate-mcp/README.md`](mcp/tollgate-mcp/README.md) — MCP tool reference

## License

MIT.

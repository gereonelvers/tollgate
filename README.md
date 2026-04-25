# Tollgate

**Paid actions for the agent web, settled instantly over Lightning.**

Tollgate is a small protocol + tooling for letting AI agents discover and buy fine-grained capabilities from websites — page access, structured extraction, site-agent answers, human verification — for sub-cent prices over the Lightning Network. Every paid action produces a portable, signed receipt.

Built for [Hack-Nation × Spiral](https://spiral.xyz) "Earn in the Agent Economy" challenge, 2026.

## What's in this repo

```
tollgate/
├── apps/publisher/          Next.js demo publisher: manifest, paid actions, dashboard, landing
├── apps/verifier/           Tiny second paid service for the agent-to-agent demo (single Node.js file)
├── mcp/tollgate-mcp/        TypeScript MCP server: discover, pay_and_invoke, spend_summary
├── skill/tollgate/          Claude Skill teaching when/how to use the MCP tools
├── scripts/test-flow.mjs    Standalone end-to-end smoke test (no Claude required)
├── .mcp.json                MCP server config (auto-loaded by Claude Code from project root)
└── policy.example.json      Example agent spending policy
```

## The 30-second story

A site declares what it sells in a JSON file at `/.well-known/tollgate.json`:

```json
{
  "version": "0.1",
  "service": { "name": "Example Pub", "description": "...", "homepage": "https://example.com" },
  "actions": [
    { "id": "ask.site_agent", "type": "site_agent_query", "price_msats": 3000, "endpoint": "...", ... },
    { "id": "extract.structured", "type": "structured_data", "price_msats": 1000, "endpoint": "...", ... }
  ],
  "receipts": { "pubkey_hex": "...", "algorithm": "ed25519" }
}
```

An agent (Claude Code with the Tollgate Skill loaded) sees a URL, calls the `discover` tool, picks an action, and hands off to `pay_and_invoke`. The MCP server:

1. Fetches the action endpoint → gets `402 Payment Required` + L402 invoice.
2. Checks deterministic policy (daily budget, per-action max, allowed action types).
3. Pays the invoice via NWC (Nostr Wallet Connect).
4. Retries the action with `Authorization: L402 <token>:<preimage>`.
5. Stores the signed receipt locally.

The model never holds wallet secrets and never approves its own spend.

## Quickstart

### Prerequisites

- Node 20+ (built on 22)
- An [Alby account](https://getalby.com) with a small balance (~5,000 sats covers thousands of demo calls)
- An NWC connection URI from Alby with `pay_invoice`, `make_invoice`, `lookup_invoice`, `get_balance` permissions

### 1. Install everything

```bash
cd apps/publisher && npm install
cd ../../mcp/tollgate-mcp && npm install && npm run build
```

### 2. Configure

```bash
cd apps/publisher
cp .env.local.example .env.local   # if needed
```

Edit `.env.local`:

```bash
# Required: where the publisher RECEIVES sats
PUBLISHER_NWC_URL=nostr+walletconnect://...

# Public URL of the publisher (port 3000 by default)
PUBLISHER_BASE_URL=http://localhost:3000

# Random secret used to sign L402 tokens
L402_SECRET=any-random-string

# Optional: enables real LLM-backed answers in ask.site_agent
ANTHROPIC_API_KEY=sk-ant-...
```

For the agent side, when you start Claude Code in this repo, set:

```bash
export AGENT_NWC_URL='nostr+walletconnect://...'
```

The two URIs can be the **same** Alby connection for the v1 demo (the agent pays the publisher, where both wallets are you). For a more authentic demo, create two separate Alby accounts and copy distinct URIs.

### 3. Run the publisher

```bash
cd apps/publisher
npm run dev
# → http://localhost:3000  (landing)
# → http://localhost:3000/dashboard  (live SSE feed)
# → http://localhost:3000/.well-known/tollgate.json  (manifest)
```

#### Mock mode (no real Lightning required)

For UI iteration or when your wallet provider is having a bad day, set `TOLLGATE_MOCK_LIGHTNING=1` and the publisher uses synthetic invoices that an in-process settle endpoint can mark paid. The dashboard shows a `MOCK LIGHTNING` badge so it's never confused with a real demo. To run end-to-end without sats:

```bash
TOLLGATE_MOCK_LIGHTNING=1 npm run dev
TOLLGATE_MOCK_LIGHTNING=1 node scripts/test-flow.mjs
```

Flip the env var off and you're back on real mainnet.

### 3b. (Optional) Run the verifier — for the agent-to-agent demo

```bash
# In a separate terminal:
cd apps/verifier
VERIFIER_NWC_URL='nostr+walletconnect://...' npm run dev
# → http://localhost:3010/.well-known/tollgate.json
```

The verifier exposes one paid action (`verify.claim` at 5 sats) and is a standalone Node.js process. With both services running, an agent can pay Site A 3 sats for an answer and then pay Site B 5 sats to fact-check it — the demo's agent-to-agent moment.

### 4. Use Claude Code with the MCP server

Start Claude Code from the `tollgate/` directory. It will auto-load `.mcp.json` and the Tollgate skill (after one-time copy below).

To register the skill globally:

```bash
mkdir -p ~/.claude/skills/tollgate
cp -r skill/tollgate/* ~/.claude/skills/tollgate/
```

Or add to your project's `.claude/skills/`:

```bash
mkdir -p .claude/skills
cp -r skill/tollgate .claude/skills/
```

To customize policy:

```bash
mkdir -p ~/.tollgate
cp policy.example.json ~/.tollgate/policy.json
# edit as desired
```

### 5. Try a paid call

In Claude Code:

> Use Tollgate on http://localhost:3000 to ask the site agent why micropayments now make sense for agents but never did for humans. Budget: 10 sats.

Watch `/dashboard` light up in real time as the request hits, the 402 challenge fires, the payment lands, and the receipt drops.

## Wire format

```
POST /api/actions/ask.site_agent
Content-Type: application/json

{ "question": "..." }

← HTTP/1.1 402 Payment Required
  WWW-Authenticate: L402 macaroon="<base64>", invoice="lnbc..."
  { "amount_msats": 3000, "invoice": "...", "token": "...", "payment_hash": "..." }

# agent pays via NWC

POST /api/actions/ask.site_agent
Authorization: L402 <token>:<preimage>

← HTTP/1.1 200 OK
  { "output": { "answer": "...", "citations": [...] }, "receipt": { "receipt_id": "...", "signature": "..." } }
```

The token binds `(payment_hash, scope, expiry)` under HMAC. Verification is purely cryptographic on the server side: `sha256(preimage) == payment_hash` ∧ token signature valid ∧ scope matches `(action_id, hash(input))` ∧ not yet consumed. **No Lightning node access is needed for the verification step** — paid status is provable from the preimage alone.

## Policy

The MCP server enforces a deterministic policy file (default at `~/.tollgate/policy.json`, override with `TOLLGATE_POLICY_PATH`). Decisions are made before payment:

- `daily_budget_msats` — total spend cap per day
- `max_per_action_msats` — refuse anything over this amount, regardless of budget
- `require_confirm_above_msats` — surface `needs_human_approval` so the user can OK it explicitly
- `allowed_action_types` — only the listed types can be paid for
- `blocked_domains` / `trusted_domains` — fine-grained overrides
- `new_service_max_msats` — cap on first-time spend with an unknown service

The model's reasoning is **never** part of the spend decision. Failure modes attributable to prompt injection or model drift are mitigated by code, not by trust.

## Receipts

Every paid action produces a JSON receipt signed by the publisher's ed25519 service key:

```json
{
  "receipt_id": "rcpt_...",
  "action_id": "ask.site_agent",
  "amount_msats": 3000,
  "payment_hash": "...",
  "input_hash": "<sha256 of canonical JSON input>",
  "output_hash": "<sha256 of output>",
  "completed_at": "2026-04-25T19:22:01.412Z",
  "service_pubkey": "<ed25519 public key>",
  "signature": "<ed25519 signature over the receipt body>"
}
```

These receipts compose: future versions of this protocol can publish them as Nostr events for portable, decentralized reputation. The current MVP stores them locally on both sides — agent in `~/.tollgate/agent.db`, publisher in `apps/publisher/data/tollgate.db`.

## Demo

See `demo/script.md` for a 90-second walkthrough script.

## License

MIT.

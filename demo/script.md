# Demo script (90 seconds)

Open three windows side by side:
1. **Browser** — http://localhost:3000/dashboard (live feed)
2. **Claude Code** — running in the repo directory
3. **Terminal** — for the legacy-fallback contrast

## 0. Setup (off-screen, before recording)

```bash
# Publisher
cd apps/publisher && npm run dev

# Reset spend history so the demo starts clean
rm -f apps/publisher/data/faregate.db apps/publisher/data/tollgate.db ~/.faregate/agent.db ~/.tollgate/agent.db
```

Confirm the dashboard shows "no paid actions yet" and "stream live."

## 1. Frame the problem (15s)

> "AI agents browse the web. They can't pay for anything. The web has 'block bots,' 'CAPTCHA,' or 'free.' That's broken — but micropayments and agents fix it for each other."

Show http://localhost:3000 (landing).

## 2. Discover (10s)

In Claude Code:

> Look up Faregate actions on http://localhost:3000.

Claude calls `discover`. Output shows two actions: `ask.site_agent` (3 sats) and `extract.structured` (1 sat), plus the service's signed identity.

> "The site declares what's for sale in a JSON file. Two actions, micropriced. Notice the prices — 1 sat is roughly six hundredths of a cent. No card rail can carry that."

## 3. Ask + pay (25s)

> Pay up to 10 sats to ask the site agent: why do micropayments work for agents but never worked for humans?

Watch the dashboard:
- Yellow "402 challenge" bar slides in
- Within ~1 second a green "200 paid" bar follows
- "Total revenue" jumps to 3 sats
- New row in the receipts table

Claude returns the cited answer + spend trail:
> *Spend trail: 3 sats — localhost:3000 / ask.site_agent — verified the 2026 micropayment claim — rcpt_abc123. Total: 3 sats. Daily remaining: 47 sats.*

## 4. Agent-to-agent verification (25s)

> Research the publisher and have a separate verifier double-check the most surprising claim. Budget: 15 sats.

Claude:
1. `discover` http://localhost:3000 → picks `ask.site_agent` (3 sats) → answer with citations
2. `discover` http://localhost:3010 → picks `verify.claim` (5 sats) → grades a key claim from the answer
3. Returns the synthesized answer + the verifier's verdict

> "Two distinct services. Two wallets. Two signed receipts. The first agent (the publisher's site agent) can't grade its own claims; the second service does. That's the agent-to-agent moment — and it's only economical because Lightning lets each hop cost 3-5 sats."

The dashboard shows revenue from the publisher; switching tabs to the verifier's `/api/receipts` shows its own receipt.

## 5. Policy refuses (10s)

> Pay 50 sats to ask the site agent: which doc is the most cited?

Claude tries `pay_and_invoke`, gets `policy_deny: amount 50000 msats exceeds max_per_action_msats 10000`. Claude tells the user:

> "Per-action limit is 10 sats. Want me to look up the answer using cheaper actions, or raise the limit?"

> "Same agent. Same wallet. The policy stopped it. The model isn't approving its own spend — code is."

## 6. Show the receipt (10s)

Click a receipt row in the dashboard.

> "Every paid action signs a receipt. Payment hash, input hash, output hash, all under the publisher's ed25519 key. Compose these and you get reputation that no single company controls."

## 7. Why Lightning, why now (curtain) — optional ad-lib

> "Card rails can't carry these payments. Stablecoins move us back into a single company's permission model. Lightning is open, instant, and tiny. The right rail for the agent web."

## End state of the demo

Dashboard shows:
- ~10-15 sats total revenue
- 4-6 paid actions
- Several receipts in the table
- One 402 challenge with no completion (the refused 50-sat call)

Total bitcoin moved: well under 2 cents.

---

## Pre-recording checklist

- [ ] Publisher running on `localhost:3000`
- [ ] Dashboard open in browser, "stream live" green
- [ ] `~/.faregate/agent.db` and `apps/publisher/data/faregate.db` deleted (also clean any legacy `~/.tollgate/`, `tollgate.db`)
- [ ] Alby wallet has at least 1000 msats balance
- [ ] `AGENT_NWC_URL` exported in Claude Code's environment
- [ ] `~/.faregate/policy.json` set to `max_per_action_msats: 10000` (so demo step 5 actually refuses)
- [ ] Browser zoom set so dashboard fits — feed + receipts both visible

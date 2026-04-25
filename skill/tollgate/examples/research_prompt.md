# Example prompts that exercise the skill

## Discover-first

> Look up tollgate paid actions on http://localhost:3000 and tell me what's available.

Expected: Claude calls `discover`, returns a list of actions with prices. No spending.

## Cheap structured extract

> Use Tollgate to extract structured data for doc.lightning_economics_2026 from http://localhost:3000. Budget: 5 sats.

Expected: Claude calls `discover`, picks `extract.structured` (1 sat), calls `pay_and_invoke`. Returns the structured doc + receipt id. Spend trail in reply.

## Site-agent question

> Pay up to 10 sats on http://localhost:3000 to find out: why do micropayments only work for agents and not humans?

Expected: Claude calls `discover`, picks `ask.site_agent` (3 sats), passes the question through, returns the cited answer. Total: 3 sats.

## Multi-action research

> Research http://localhost:3000 thoroughly. Budget: 30 sats. Show your work.

Expected: Claude does several paid actions — `extract.structured` for each doc, then `ask.site_agent` for synthesis. Stays under 30 sats.

## Agent-to-agent verification (cross-service)

> Ask the site agent at http://localhost:3000 about Lightning micropayments, then have the verifier at http://localhost:3010 fact-check the most surprising claim. Budget: 15 sats.

Expected: Claude calls `discover` on each URL, then `pay_and_invoke` once per service (3 sats to publisher, 5 sats to verifier). Two receipts, two distinct service pubkeys. Total: 8 sats.

## Policy refusal

> Pay 100 sats on http://localhost:3000 to ask: what is bitcoin?

Expected: `pay_and_invoke` returns `policy_deny` because either per-action max or daily budget is hit. Claude explains, offers to scale down or for the user to raise their policy.

## Budget question

> How much have I spent on Lightning this week through Tollgate?

Expected: Claude calls `spend_summary` with period=week and reports the breakdown.

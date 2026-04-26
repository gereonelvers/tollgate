# @agents402/mcp

An MCP server that lets your AI agent pay for [L402](https://docs.lightning.engineering/the-lightning-network/l402) paid actions over Lightning, with deterministic spend policy, decentralized reputation, and in-band wallet setup. The reference implementation of the [agents402](https://agents402.org) protocol, by [Faregate](https://faregate.org).

## Install

In your MCP client config (e.g. `~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "faregate": {
      "command": "npx",
      "args": ["-y", "@agents402/mcp"]
    }
  }
}
```

That's it. No wallet pre-configuration required — the first time the agent hits a paywall, it will ask you how you want to pair a wallet.

## What the agent gets

| Tool | Purpose |
| --- | --- |
| `discover` | Look up an `agents402.json` manifest for a domain — what paid actions, what prices, network reputation. |
| `pay_and_invoke` | Pay an L402 challenge and run the action atomically, under your spend policy. |
| `publish_feedback` | Publish a Nostr `kind:30402` rating receipt-anchored to the call you just paid for. |
| `get_reputation` | Compute weighted reputation (`Σ amount × score / Σ amount`) for a service from Nostr. |
| `spend_summary` | Today / week / all-time spend grouped by domain. |
| `wallet_status` | Is a wallet configured? Provider, label, source. |
| `wallet_setup_nwc` | Pair a Nostr-Wallet-Connect URI you already have. |
| `wallet_setup_browser` | Open the user's browser to create a self-custodial Spark wallet (with sponsor faucet). |
| `wallet_setup_check` | Poll the in-progress browser pairing. |
| `wallet_setup_cancel` | Close the localhost listener if the user changes their mind. |

## How wallet setup works

When `pay_and_invoke` is called without a wallet, it returns a structured `needs_setup` response listing the two paths. The agent presents these to the user and calls one of:

- **`wallet_setup_nwc({ nwc_url, label? })`** — User pastes a `nostr+walletconnect://` URI. The MCP validates it by calling `getBalance` and saves to `~/.faregate/wallet.json`.
- **`wallet_setup_browser()`** — MCP binds a random `127.0.0.1` port, opens the browser to `wallet.faregate.org/setup/new?callback=…&state=…`, and the page POSTs the new wallet config to the listener once the user finishes the flow. Then `wallet_setup_check` confirms.

In both cases the user holds the keys. The MCP never transmits the wallet config off-machine.

## Spend policy

Read from `~/.faregate/policy.json`. Refusals happen in code, not in the model — if a call would breach `daily_budget_msats`, `per_action_max_msats`, allowed action types, trusted domains, or network-reputation gates, `pay_and_invoke` refuses before any payment.

## Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `FAREGATE_DATA_DIR` | `~/.faregate` | Where `wallet.json`, `policy.json`, `agent.db` live. (`TOLLGATE_DATA_DIR` and `~/.tollgate/` are read as fallbacks for users who set up before the rename.) |
| `FAREGATE_POLICY_PATH` | `<data_dir>/policy.json` | Override the policy file path. |
| `AGENTS402_WEB_URL` | `https://wallet.faregate.org` | Web app to open for browser pairing. |
| `AGENT_NWC_URL` | — | Legacy fallback if no `wallet.json` is present. |
| `FAREGATE_NOSTR_RELAYS` | (built-in set) | Comma-separated relay URLs for reputation publish/fetch. |

## Source

[github.com/gereonelvers/tollgate](https://github.com/gereonelvers/tollgate) — `mcp/tollgate-mcp`.

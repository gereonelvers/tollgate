# @agents402/setup

Pair a self-custodial Lightning wallet from the [agents402](https://agents402.org)
web app to your local MCP server in one shot — no manual file copy, no browser
tab pinning.

## Usage

```sh
npx @agents402/setup
```

This:

1. Opens a localhost listener on a random port.
2. Opens your browser to `https://agents402.org/setup/new` with a callback URL
   and a single-use state token.
3. After you create a wallet and confirm your seed phrase, the web page POSTs
   the wallet config to the localhost listener.
4. The CLI writes `~/.tollgate/wallet.json` (mode `0600`) and exits.

Restart your MCP client to pick up the new wallet.

## Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `AGENTS402_WEB_URL` | `https://agents402.org` | Web origin to open. |
| `AGENTS402_SETUP_PORT` | random | Pin the localhost listener port. |
| `AGENTS402_SETUP_TIMEOUT_MS` | `300000` | How long to wait for the browser POST. |
| `TOLLGATE_DATA_DIR` | `~/.tollgate` | Where to write `wallet.json`. |

## Security

- The state token is generated locally; the web page must echo it back in
  `X-Agents402-State` for the CLI to accept the config.
- The listener binds to `127.0.0.1` only.
- Wallet config is written with file mode `0600`.
- Same OAuth-callback pattern used by `gh auth login` and `gcloud auth login`.

## Source

[github.com/gereonelvers/tollgate](https://github.com/gereonelvers/tollgate) —
`packages/cli`.

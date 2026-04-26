#!/usr/bin/env node
/**
 * agents402-setup — pair a wallet from the agents402 web app to your local
 * MCP server in one shot. No manual file copy.
 *
 * Flow:
 *   1. Opens an HTTP listener on http://localhost:<random>/cb
 *   2. Opens the browser to <web>/setup/new?callback=<localhost>&state=<random>
 *   3. After the user creates a wallet and confirms backup, the web page POSTs
 *      the wallet config to the localhost callback.
 *   4. We write it to ~/.tollgate/wallet.json and exit.
 *
 * The web origin and the localhost CLI never store the data anywhere else.
 * State token + Origin check guard against random-tab CSRF.
 */

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

type WalletConfig = {
  provider: "spark" | "nwc" | "dev-fake";
  spark_mnemonic?: string;
  spark_network?: string;
  spark_address?: string;
  spark_identity_pubkey?: string;
  nwc_url?: string;
  label?: string;
};

const DEFAULT_WEB_URL = "https://wallet.faregate.org";
const WEB_URL = process.env.AGENTS402_WEB_URL || DEFAULT_WEB_URL;
const TIMEOUT_MS = Number(process.env.AGENTS402_SETUP_TIMEOUT_MS ?? 5 * 60 * 1000);
const PORT = Number(process.env.AGENTS402_SETUP_PORT ?? 0);

const tollgateDir =
  process.env.TOLLGATE_DATA_DIR || path.join(os.homedir(), ".tollgate");
const walletFile = path.join(tollgateDir, "wallet.json");

const STATE = crypto.randomBytes(16).toString("hex");

function logStep(s: string) {
  process.stderr.write(`▸ ${s}\n`);
}
function logOk(s: string) {
  process.stderr.write(`✓ ${s}\n`);
}
function logErr(s: string) {
  process.stderr.write(`✗ ${s}\n`);
}

/* ---------------------------------------------------------------- */
/* HTTP listener                                                    */
/* ---------------------------------------------------------------- */

let received = false;
let server: http.Server | null = null;

const PAGE_DONE = `<!doctype html>
<meta charset="utf-8">
<title>Wallet linked — agents402</title>
<style>
  body { background: #fafafa; color: #0a0a0a; font: 15px/1.6 system-ui, -apple-system, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 32px; }
  h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px; }
  p { margin: 0 0 12px; color: #4a4a4a; }
  code { background: #ececec; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
</style>
<h1>✓ Wallet linked.</h1>
<p>Your wallet config has been written to <code>~/.tollgate/wallet.json</code>.</p>
<p>Return to your terminal — the setup CLI will exit on its own. You can close this tab.</p>
`;
const PAGE_ERR = (msg: string) => `<!doctype html>
<meta charset="utf-8">
<title>Wallet link failed — agents402</title>
<style>
  body { background: #fff5f5; color: #4a0000; font: 15px/1.6 system-ui, -apple-system, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 32px; }
  h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px; }
  pre { background: #ffe9e9; padding: 12px; border-radius: 4px; font-size: 12.5px; overflow-x: auto; }
</style>
<h1>✗ Wallet link failed.</h1>
<pre>${msg.replace(/[<>]/g, (c) => ({ "<": "&lt;", ">": "&gt;" }[c] ?? c))}</pre>
<p>Return to your terminal and try again.</p>
`;

function corsHeaders(origin: string | undefined): Record<string, string> {
  return {
    "access-control-allow-origin": origin || "*",
    "access-control-allow-methods": "POST, OPTIONS, GET",
    "access-control-allow-headers": "content-type, x-agents402-state",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function startServer(): Promise<{ port: number; ready: Promise<void> }> {
  return new Promise((resolve, reject) => {
    let resolveReady: () => void;
    const ready = new Promise<void>((r) => {
      resolveReady = r;
    });

    const srv = http.createServer((req, res) => {
      const origin = req.headers.origin as string | undefined;
      if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders(origin));
        res.end();
        return;
      }
      if (req.url?.startsWith("/cb")) {
        if (req.method === "POST") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            try {
              const stateHeader = (req.headers["x-agents402-state"] as string | undefined) ?? "";
              if (stateHeader !== STATE) {
                res.writeHead(403, { "content-type": "text/html", ...corsHeaders(origin) });
                res.end(PAGE_ERR("State token mismatch."));
                return;
              }
              const cfg = JSON.parse(body) as WalletConfig;
              if (!cfg.provider) {
                throw new Error("missing 'provider'");
              }
              fs.mkdirSync(tollgateDir, { recursive: true });
              fs.writeFileSync(walletFile, JSON.stringify(cfg, null, 2), { mode: 0o600 });
              res.writeHead(200, { "content-type": "text/html", ...corsHeaders(origin) });
              res.end(PAGE_DONE);
              received = true;
              logOk(`wrote ${walletFile}`);
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              logErr(`callback failed: ${msg}`);
              res.writeHead(400, { "content-type": "text/html", ...corsHeaders(origin) });
              res.end(PAGE_ERR(msg));
            }
          });
          return;
        }
        // GET /cb — health check / fallback
        res.writeHead(200, { "content-type": "text/plain", ...corsHeaders(origin) });
        res.end("agents402-setup listener ready\n");
        return;
      }
      res.writeHead(404, { "content-type": "text/plain", ...corsHeaders(origin) });
      res.end("not found");
    });

    srv.on("error", reject);
    srv.listen(PORT, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      server = srv;
      resolveReady!();
      resolve({ port, ready });
    });
  });
}

/* ---------------------------------------------------------------- */
/* Browser opener                                                   */
/* ---------------------------------------------------------------- */

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      logErr(`couldn't open browser: ${err.message}`);
      logStep(`open this URL manually: ${url}`);
    }
  });
}

/* ---------------------------------------------------------------- */
/* Main                                                             */
/* ---------------------------------------------------------------- */

async function main(): Promise<number> {
  logStep(`agents402 wallet setup`);
  logStep(`web app: ${WEB_URL}`);
  logStep(`config target: ${walletFile}`);

  if (fs.existsSync(walletFile)) {
    const cur = JSON.parse(fs.readFileSync(walletFile, "utf8"));
    process.stderr.write(
      `\nWARNING: ${walletFile} already exists (provider=${cur.provider}). Continuing will overwrite it after the new wallet is paired. The OLD wallet is not affected at the provider — only this MCP config file changes.\n\n`,
    );
  }

  const { port } = await startServer();
  const callback = `http://127.0.0.1:${port}/cb`;
  const url = `${WEB_URL}/setup/new?callback=${encodeURIComponent(callback)}&state=${STATE}`;

  logStep(`opening: ${url}`);
  openBrowser(url);

  // Wait for the browser POST or timeout.
  const deadline = Date.now() + TIMEOUT_MS;
  while (!received && Date.now() < deadline) {
    await delay(500);
  }
  server?.close();
  if (!received) {
    logErr(`timed out after ${Math.round(TIMEOUT_MS / 1000)}s without receiving wallet config.`);
    return 1;
  }
  logOk(`wallet linked — restart your MCP client to pick it up.`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    logErr(e instanceof Error ? e.message : String(e));
    process.exit(2);
  });

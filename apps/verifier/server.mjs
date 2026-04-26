#!/usr/bin/env node
/**
 * Faregate verifier — a tiny second paid service for agent-to-agent demos.
 *
 * Exposes:
 *   GET  /.well-known/agents402.json       — manifest (one action)
 *   POST /api/actions/verify.claim         — L402-protected claim verifier
 *
 * Same wire format as the publisher, deliberately minimal so it's easy to read.
 */

import http from "node:http";
import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { NWCClient } from "@getalby/sdk";

const PORT = Number(process.env.PORT ?? 3010);
const BASE = process.env.VERIFIER_BASE_URL ?? `http://localhost:${PORT}`;
const SECRET = process.env.L402_SECRET ?? "verifier-dev-secret";
const NWC_URL = process.env.VERIFIER_NWC_URL;

const PRICE_MSATS = 5000;

// ---- tiny "fact base" --------------------------------------------------
const FACT_DB = [
  {
    keywords: ["lightning", "micropayment", "fraction", "cent"],
    verdict: "supported",
    confidence: 0.93,
    note: "Lightning routinely settles sub-cent payments; fees < 0.5 sat are common.",
    source: "verifier.facts.lightning_micropayments",
  },
  {
    keywords: ["agent", "checkout", "captcha", "card"],
    verdict: "supported",
    confidence: 0.88,
    note: "Card-rail UX assumes a human attendee (CAPTCHA/3DS); incompatible with autonomous agents.",
    source: "verifier.facts.agent_checkout_friction",
  },
  {
    keywords: ["stablecoin", "freeze", "centralized", "issuer"],
    verdict: "supported",
    confidence: 0.91,
    note: "Major stablecoin issuers retain freeze authority on-chain (Circle, Tether public statements).",
    source: "verifier.facts.stablecoin_central",
  },
  {
    keywords: ["scrape", "free", "bot", "publisher"],
    verdict: "supported",
    confidence: 0.78,
    note: "Multiple 2025-26 industry surveys document scraper traffic exceeding paid traffic for many publications.",
    source: "verifier.facts.scrape_economics",
  },
];

// ---- L402 helpers (same wire format as publisher) ---------------------
const b64url = (b) =>
  Buffer.from(b)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const fromB64url = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(s.replaceAll("-", "+").replaceAll("_", "/") + pad, "base64");
};
const hmac = (input) => crypto.createHmac("sha256", SECRET).update(input).digest();

function issueToken(paymentHash, scope, ttl = 900) {
  const body = {
    ph: paymentHash.toLowerCase(),
    sc: scope,
    exp: Math.floor(Date.now() / 1000) + ttl,
    n: crypto.randomBytes(8).toString("hex"),
  };
  const b = b64url(JSON.stringify(body));
  return `${b}.${b64url(hmac(b))}`;
}
function verifyToken(token, scope) {
  const [b, sig] = token.split(".");
  if (!b || !sig) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(b64url(hmac(b))))) return null;
  let body;
  try {
    body = JSON.parse(fromB64url(b).toString("utf8"));
  } catch {
    return null;
  }
  if (body.exp < Math.floor(Date.now() / 1000)) return null;
  if (body.sc !== scope) return null;
  return body;
}
function preimageMatchesHash(preimage, paymentHash) {
  return (
    crypto.createHash("sha256").update(Buffer.from(preimage, "hex")).digest("hex").toLowerCase() ===
    paymentHash.toLowerCase()
  );
}

// ---- service identity (ed25519) --------------------------------------
import fs from "node:fs";
import path from "node:path";
const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const skPath = path.join(dataDir, "verifier.ed25519.pem");
let serviceKeyPair;
if (fs.existsSync(skPath)) {
  const sk = crypto.createPrivateKey(fs.readFileSync(skPath));
  serviceKeyPair = { privateKey: sk, publicKey: crypto.createPublicKey(sk) };
} else {
  serviceKeyPair = crypto.generateKeyPairSync("ed25519");
  fs.writeFileSync(skPath, serviceKeyPair.privateKey.export({ format: "pem", type: "pkcs8" }));
}
const SERVICE_PUBKEY_HEX = serviceKeyPair.publicKey
  .export({ format: "der", type: "spki" })
  .toString("hex");

// ---- wallet ----------------------------------------------------------
let wallet = null;
function getWallet() {
  if (wallet) return wallet;
  if (!NWC_URL) throw new Error("VERIFIER_NWC_URL not set");
  wallet = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
  return wallet;
}

// ---- in-memory challenge & receipt store ------------------------------
const challenges = new Map(); // payment_hash -> {action_id, input_hash, amount_msats, consumed}
const receipts = [];

// ---- action handler --------------------------------------------------
function evaluateClaim(claim) {
  const tokens = claim.toLowerCase().split(/\W+/).filter(Boolean);
  let best = null;
  for (const fact of FACT_DB) {
    const overlap = fact.keywords.filter((k) => tokens.includes(k)).length;
    if (overlap > 0 && (!best || overlap > best.overlap)) {
      best = { fact, overlap };
    }
  }
  if (!best) {
    return {
      verdict: "uncertain",
      confidence: 0.3,
      note: "Claim does not match any fact in the verifier's local knowledge base.",
      sources: [],
    };
  }
  return {
    verdict: best.fact.verdict,
    confidence: best.fact.confidence,
    note: best.fact.note,
    sources: [best.fact.source],
  };
}

const ACTION = {
  id: "verify.claim",
  type: "verification",
  title: "Independent claim verifier",
  description:
    "Pay this service to independently grade a claim against its local fact base. Returns verdict + confidence + sources.",
  endpoint: `${BASE}/api/actions/verify.claim`,
  method: "POST",
  price_msats: PRICE_MSATS,
  input_schema: {
    type: "object",
    properties: { claim: { type: "string", maxLength: 500 } },
    required: ["claim"],
  },
  risk: "low",
};

// ---- HTTP server -----------------------------------------------------
function send(res, status, body, headers = {}) {
  const buf = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "WWW-Authenticate",
    ...headers,
  });
  res.end(buf);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, BASE);
    if (req.method === "GET" && url.pathname === "/.well-known/agents402.json") {
      return send(res, 200, {
        version: "0.1",
        service: {
          name: "Faregate Verifier",
          description: "A second paid service that grades claims for agents. Use it to fact-check answers from other services.",
          homepage: BASE,
        },
        actions: [ACTION],
        receipts: { pubkey_hex: SERVICE_PUBKEY_HEX, algorithm: "ed25519" },
      });
    }
    if (req.method === "POST" && url.pathname === "/api/actions/verify.claim") {
      const body = await readBody(req);
      if (!body || typeof body !== "object") return send(res, 400, { error: "invalid_json" });
      if (typeof body.claim !== "string" || body.claim.length === 0 || body.claim.length > 500)
        return send(res, 400, { error: "invalid_input", expected: "claim:string<=500" });
      const inputHash = crypto.createHash("sha256").update(JSON.stringify({ claim: body.claim })).digest("hex");

      const auth = req.headers["authorization"];
      if (!auth) {
        // Issue 402 challenge.
        let invoice;
        try {
          invoice = await getWallet().makeInvoice({
            amount: PRICE_MSATS,
            description: `faregate-verifier:verify.claim`,
            expiry: 900,
          });
        } catch (e) {
          return send(res, 503, {
            error: "invoice_creation_failed",
            detail: e?.message ?? String(e),
            hint: "Set VERIFIER_NWC_URL and restart.",
          });
        }
        const token = issueToken(invoice.payment_hash, `verify.claim:${inputHash}`);
        challenges.set(invoice.payment_hash.toLowerCase(), {
          action_id: "verify.claim",
          input_hash: inputHash,
          amount_msats: PRICE_MSATS,
          consumed: false,
        });
        return send(
          res,
          402,
          {
            error: "payment_required",
            action_id: "verify.claim",
            amount_msats: PRICE_MSATS,
            invoice: invoice.invoice,
            payment_hash: invoice.payment_hash,
            token,
            expires_at: invoice.expires_at,
          },
          { "www-authenticate": `L402 macaroon="${token}", invoice="${invoice.invoice}"` },
        );
      }

      // Verify auth: token first, then settle status (preimage if cryptographic, else lookup).
      const m = /^L402\s+([^:]+):([0-9a-fA-F-]+)\s*$/.exec(auth);
      if (!m) return send(res, 401, { error: "malformed_authorization" });
      const [, token, preimage] = m;
      const tokenBody = verifyToken(token, `verify.claim:${inputHash}`);
      if (!tokenBody) return send(res, 401, { error: "invalid_or_expired_token" });
      const ch = challenges.get(tokenBody.ph);
      if (!ch) return send(res, 401, { error: "unknown_challenge" });
      if (ch.consumed) return send(res, 401, { error: "token_already_consumed" });
      const preimageOk = preimageMatchesHash(preimage, tokenBody.ph);
      if (!preimageOk) {
        let settled = false;
        let last = "unknown";
        for (let attempt = 0; attempt < 4 && !settled; attempt++) {
          try {
            const inv = await getWallet().lookupInvoice({ payment_hash: tokenBody.ph });
            last = inv.state ?? "unknown";
            if (inv.state === "settled") settled = true;
          } catch {}
          if (!settled) await new Promise((r) => setTimeout(r, 600));
        }
        if (!settled) {
          return send(res, 425, {
            error: "payment_not_confirmed",
            payment_hash: tokenBody.ph,
            last_state: last,
            hint: "Invoice not settled at the verifier's wallet yet; retry shortly.",
          });
        }
      }
      ch.consumed = true;

      // Evaluate claim.
      const out = evaluateClaim(body.claim);

      // Optional buyer pubkey for verifiable Nostr feedback later.
      const buyerHeader = req.headers["x-agents402-buyer-pubkey"];
      const buyer_pubkey =
        typeof buyerHeader === "string" && /^[0-9a-f]{64}$/i.test(buyerHeader.trim())
          ? buyerHeader.trim().toLowerCase()
          : undefined;

      // Sign receipt — fields in alphabetical order, omitting absent optional fields.
      const completedAt = new Date().toISOString();
      const outputText = JSON.stringify(out);
      const outputHash = crypto.createHash("sha256").update(outputText).digest("hex");
      const CORE_KEYS = [
        "action_id", "amount_msats", "buyer_pubkey", "completed_at",
        "input_hash", "output_hash", "payment_hash", "receipt_id", "service_pubkey",
      ];
      const core = {
        action_id: "verify.claim",
        amount_msats: PRICE_MSATS,
        ...(buyer_pubkey ? { buyer_pubkey } : {}),
        completed_at: completedAt,
        input_hash: inputHash,
        output_hash: outputHash,
        payment_hash: tokenBody.ph,
        receipt_id: `rcpt_${nanoid(12)}`,
        service_pubkey: SERVICE_PUBKEY_HEX,
      };
      const present = CORE_KEYS.filter((k) => core[k] !== undefined);
      const canonical = JSON.stringify(core, present);
      const sig = crypto.sign(null, Buffer.from(canonical), serviceKeyPair.privateKey).toString("hex");
      const receipt = { ...core, signature: sig };
      receipts.unshift(receipt);
      if (receipts.length > 100) receipts.length = 100;

      return send(res, 200, { output: out, receipt });
    }

    if (req.method === "GET" && url.pathname === "/api/receipts") {
      return send(res, 200, { receipts });
    }
    if (req.method === "GET" && url.pathname === "/") {
      return send(
        res,
        200,
        "<!doctype html><meta charset=utf-8><title>Faregate Verifier</title><body style=\"font-family:ui-monospace,monospace;background:#0a0a0f;color:#fafafa;padding:48px;max-width:720px;margin:auto\"><h1 style=\"color:#fbbf24\">faregate verifier</h1><p>A second paid service for the agent economy demo. Run by an entity that's not the publisher. Pay 5 sats per <code>verify.claim</code> request.</p><p><a style=\"color:#fbbf24\" href=\"/.well-known/agents402.json\">manifest</a> · <a style=\"color:#fbbf24\" href=\"/api/receipts\">receipts</a></p></body>",
        { "content-type": "text/html; charset=utf-8" },
      );
    }
    send(res, 404, { error: "not_found", path: url.pathname });
  } catch (e) {
    send(res, 500, { error: "server_error", detail: e?.message ?? String(e) });
  }
});

server.listen(PORT, () => {
  process.stdout.write(`faregate-verifier listening on ${BASE}\n`);
  process.stdout.write(`  manifest: ${BASE}/.well-known/agents402.json\n`);
  process.stdout.write(`  action:   ${BASE}/api/actions/verify.claim (${PRICE_MSATS} msats)\n`);
});

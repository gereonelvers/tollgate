import crypto from "node:crypto";

const SECRET = process.env.L402_SECRET || "dev-secret-change-me";

export type L402TokenBody = {
  ph: string;
  sc: string;
  exp: number;
  n: string;
};

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf as Buffer | string)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const fromB64url = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(s.replaceAll("-", "+").replaceAll("_", "/") + pad, "base64");
};

const hmac = (input: string) =>
  crypto.createHmac("sha256", SECRET).update(input).digest();

export function issueL402Token(opts: {
  paymentHash: string;
  scope: string;
  ttlSeconds?: number;
}): string {
  const body: L402TokenBody = {
    ph: opts.paymentHash.toLowerCase(),
    sc: opts.scope,
    exp: Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? 900),
    n: crypto.randomBytes(8).toString("hex"),
  };
  const bodyB64 = b64url(JSON.stringify(body));
  const sig = b64url(hmac(bodyB64));
  return `${bodyB64}.${sig}`;
}

export function verifyL402Token(token: string, scope: string): L402TokenBody | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [bodyB64, sig] = parts;
  const expected = b64url(hmac(bodyB64));
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let body: L402TokenBody;
  try {
    body = JSON.parse(fromB64url(bodyB64).toString("utf8"));
  } catch {
    return null;
  }
  if (body.exp < Math.floor(Date.now() / 1000)) return null;
  if (body.sc !== scope) return null;
  return body;
}

export function preimageMatchesHash(preimage: string, paymentHash: string): boolean {
  const hash = crypto.createHash("sha256").update(Buffer.from(preimage, "hex")).digest("hex");
  return hash.toLowerCase() === paymentHash.toLowerCase();
}

export function parseL402Auth(headerValue: string | null): { token: string; preimage: string } | null {
  if (!headerValue) return null;
  // Spec preimage is 64-char hex, but some NWC backends (e.g. Coinos) return a UUID-style
  // identifier instead. We accept any non-empty token-like value here and let the caller
  // verify settle status via wallet lookup if it isn't a real preimage.
  const m = /^L402\s+([^:\s]+):([^\s]+)\s*$/.exec(headerValue);
  if (!m) return null;
  return { token: m[1], preimage: m[2] };
}

export function buildChallengeHeader(token: string, invoice: string): string {
  return `L402 macaroon="${token}", invoice="${invoice}"`;
}

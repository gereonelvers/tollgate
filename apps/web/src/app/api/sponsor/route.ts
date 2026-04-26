import { NextRequest, NextResponse } from "next/server";
import { NWCClient } from "@getalby/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPONSOR_NWC_URL = process.env.SPONSOR_NWC_URL;
const MAX_GRANT_MSATS = Number(process.env.SPONSOR_MAX_GRANT_MSATS ?? 50_000); // 50 sats
const COOLDOWN_MS = Number(process.env.SPONSOR_COOLDOWN_MS ?? 24 * 60 * 60 * 1000); // 24h

/* In-memory rate-limit + grant log. Naïve, fine for the prototype.
   Resets on server restart. Production would use a real store + better identifiers. */
type GrantRecord = { last_at: number; total_grants: number };
const grants = new Map<string, GrantRecord>();

function ipFromRequest(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return "unknown";
}

export async function POST(req: NextRequest) {
  if (!SPONSOR_NWC_URL) {
    return NextResponse.json(
      {
        ok: false,
        error: "sponsor_disabled",
        reason:
          "Set SPONSOR_NWC_URL to a funded NWC wallet on the server side to enable the faucet.",
      },
      { status: 503 },
    );
  }

  let body: { wallet_public_id?: string; invoice?: string; payment_hash?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const invoice = body.invoice?.trim();
  if (!invoice || !/^lnbc/i.test(invoice)) {
    return NextResponse.json(
      { ok: false, error: "invoice_required", reason: "Provide a BOLT11 invoice for ~50 sats." },
      { status: 400 },
    );
  }

  // Rate-limit by IP + wallet_public_id (lightning address or any stable identifier the
  // browser shares). Either-axis exhaustion blocks; both must be cool to grant.
  const ip = ipFromRequest(req);
  const wid = (body.wallet_public_id ?? "anon").slice(0, 256);
  const now = Date.now();
  for (const key of [`ip:${ip}`, `wid:${wid}`]) {
    const r = grants.get(key);
    if (r && now - r.last_at < COOLDOWN_MS) {
      const wait_ms = COOLDOWN_MS - (now - r.last_at);
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          reason: `One grant per identifier per ${Math.round(COOLDOWN_MS / 3600_000)}h. Try again in ${Math.round(wait_ms / 60_000)} min.`,
          axis: key.startsWith("ip:") ? "ip" : "wallet",
        },
        { status: 429 },
      );
    }
  }

  // Pay it.
  let result;
  try {
    const client = new NWCClient({ nostrWalletConnectUrl: SPONSOR_NWC_URL });
    result = await client.payInvoice({ invoice });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: "payment_failed",
        reason: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  // Record metadata only — we don't track balances.
  for (const key of [`ip:${ip}`, `wid:${wid}`]) {
    const r = grants.get(key);
    grants.set(key, { last_at: now, total_grants: (r?.total_grants ?? 0) + 1 });
  }

  return NextResponse.json({
    ok: true,
    amount_msats_attempted: MAX_GRANT_MSATS,
    fees_paid_msats: result.fees_paid ?? 0,
    sponsored_at: new Date().toISOString(),
  });
}

/** GET = simple status check. Useful for health probes. */
export function GET() {
  return NextResponse.json({
    available: Boolean(SPONSOR_NWC_URL),
    max_grant_msats: MAX_GRANT_MSATS,
    cooldown_hours: Math.round(COOLDOWN_MS / 3600_000),
  });
}

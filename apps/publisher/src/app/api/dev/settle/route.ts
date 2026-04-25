import { NextRequest, NextResponse } from "next/server";
import { mockMarkSettled } from "@/lib/nwc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.TOLLGATE_MOCK_LIGHTNING !== "1") {
    return NextResponse.json({ error: "mock mode disabled" }, { status: 404 });
  }
  let body: { payment_hash?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.payment_hash || typeof body.payment_hash !== "string") {
    return NextResponse.json({ error: "missing_payment_hash" }, { status: 400 });
  }
  const ok = mockMarkSettled(body.payment_hash);
  return NextResponse.json({ ok, payment_hash: body.payment_hash });
}

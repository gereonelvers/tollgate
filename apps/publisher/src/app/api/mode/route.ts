import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    mock_lightning: process.env.TOLLGATE_MOCK_LIGHTNING === "1",
    has_anthropic_key: Boolean(process.env.ANTHROPIC_API_KEY),
    publisher_lightning_address: process.env.PUBLISHER_LIGHTNING_ADDRESS ?? null,
  });
}

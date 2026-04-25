import { NextResponse } from "next/server";
import { listRecentReceipts, revenueByAction, totalRevenueMsats } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      total_revenue_msats: totalRevenueMsats(),
      by_action: revenueByAction(),
      receipts: listRecentReceipts(50),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

import { NextResponse } from "next/server";
import { listActions } from "@/lib/actions";
import { getServiceKeys } from "@/lib/keys";
import type { Manifest } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET() {
  const { publicKey } = getServiceKeys();
  const homepage =
    process.env.PUBLISHER_BASE_URL || "http://localhost:3000";
  const manifest: Manifest = {
    version: "0.1",
    service: {
      name: "The Halving Gazette",
      description:
        "A demo publication exposing paid AI-agent actions over Lightning. All the news that's small enough to settle on a single block. Visit the dashboard to watch sats arrive.",
      homepage,
      lightning_address: process.env.PUBLISHER_LIGHTNING_ADDRESS,
    },
    actions: listActions(),
    receipts: {
      pubkey_hex: publicKey,
      algorithm: "ed25519",
    },
  };
  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

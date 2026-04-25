import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  ACTIONS,
  getAction,
  hashInput,
  hashOutput,
} from "@/lib/actions";
import {
  buildChallengeHeader,
  issueL402Token,
  parseL402Auth,
  preimageMatchesHash,
  verifyL402Token,
} from "@/lib/l402";
import { createInvoice, isInvoiceSettled } from "@/lib/nwc";
import {
  getChallenge,
  insertReceipt,
  markChallengeConsumed,
  recordChallenge,
} from "@/lib/db";
import { publish } from "@/lib/events";
import { getServiceKeys, signReceipt } from "@/lib/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { id: actionId } = await ctx.params;
  const def = getAction(actionId);
  if (!def) {
    return NextResponse.json(
      { error: "unknown_action", action_id: actionId, known: Object.keys(ACTIONS) },
      { status: 404 },
    );
  }

  const rawBody = await req.text();
  let body: unknown = {};
  if (rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
  }

  // Validate input shape early — we want to reject 400 before issuing an invoice.
  const inputCheck = def.inputSchema.safeParse(body);
  if (!inputCheck.success) {
    return NextResponse.json(
      { error: "invalid_input", details: inputCheck.error.flatten() },
      { status: 400 },
    );
  }

  const inputHash = hashInput(inputCheck.data);
  const auth = parseL402Auth(req.headers.get("authorization"));

  // No auth header → issue a 402 challenge.
  if (!auth) {
    let invoice;
    try {
      invoice = await createInvoice({
        amountMsats: def.manifest.price_msats,
        description: `tollgate:${actionId}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          error: "invoice_creation_failed",
          detail: msg,
          hint: "Set PUBLISHER_NWC_URL in .env.local and restart the server.",
        },
        { status: 503 },
      );
    }
    const token = issueL402Token({
      paymentHash: invoice.payment_hash,
      scope: `${actionId}:${inputHash}`,
    });
    recordChallenge({
      payment_hash: invoice.payment_hash,
      action_id: actionId,
      input_hash: inputHash,
      raw_input: JSON.stringify(inputCheck.data),
      amount_msats: def.manifest.price_msats,
    });
    publish({
      type: "challenge_issued",
      data: {
        action_id: actionId,
        amount_msats: def.manifest.price_msats,
        payment_hash: invoice.payment_hash,
        invoice: invoice.invoice,
      },
    });
    const headers = new Headers({
      "WWW-Authenticate": buildChallengeHeader(token, invoice.invoice),
      "Cache-Control": "no-store",
      "Access-Control-Expose-Headers": "WWW-Authenticate",
    });
    return new NextResponse(
      JSON.stringify({
        error: "payment_required",
        action_id: actionId,
        amount_msats: def.manifest.price_msats,
        invoice: invoice.invoice,
        payment_hash: invoice.payment_hash,
        token,
        expires_at: invoice.expires_at,
      }),
      { status: 402, headers: { ...Object.fromEntries(headers), "content-type": "application/json" } },
    );
  }

  // Auth header present — verify token, then verify settle status via wallet lookup.
  const tokenBody = verifyL402Token(auth.token, `${actionId}:${inputHash}`);
  if (!tokenBody) {
    return NextResponse.json(
      { error: "invalid_or_expired_token" },
      { status: 401 },
    );
  }
  const challenge = getChallenge(tokenBody.ph);
  if (!challenge) {
    return NextResponse.json({ error: "unknown_challenge" }, { status: 401 });
  }
  if (challenge.consumed) {
    return NextResponse.json({ error: "token_already_consumed" }, { status: 401 });
  }
  // If the agent provided a real cryptographic preimage we accept that proof; otherwise
  // (some NWC backends like Coinos return non-preimage IDs) we fall back to a wallet
  // lookup to confirm the invoice settled. The wire format is identical either way.
  const preimageOk = preimageMatchesHash(auth.preimage, tokenBody.ph);
  if (!preimageOk) {
    // Some wallets (Coinos, Primal) don't expose real preimages, so fall back to
    // wallet-side settle confirmation. We give Primal up to ~12 s to propagate
    // payment notifications across its relay before giving up.
    let settled = false;
    const maxAttempts = 12;
    for (let attempt = 0; attempt < maxAttempts && !settled; attempt++) {
      settled = await isInvoiceSettled(tokenBody.ph);
      if (!settled) await new Promise((r) => setTimeout(r, 1000));
    }
    if (!settled) {
      return NextResponse.json(
        {
          error: "payment_not_confirmed",
          payment_hash: tokenBody.ph,
          hint: "Invoice not settled at the publisher's wallet yet; retry in a moment.",
        },
        { status: 425 },
      );
    }
  }

  // Execute the action.
  const result = await def.handler(inputCheck.data);
  markChallengeConsumed(tokenBody.ph);

  // Build, sign, store, publish receipt.
  const { publicKey } = getServiceKeys();
  const completedAt = new Date().toISOString();
  const outputHash = hashOutput(result.output_text_for_hash);
  // Optional buyer pubkey — agent can hand us a Nostr pubkey it controls so it
  // can later publish verifiable feedback. Hex-encoded 32-byte schnorr pubkey.
  const buyerHeader = req.headers.get("x-tollgate-buyer-pubkey");
  const buyer_pubkey =
    buyerHeader && /^[0-9a-f]{64}$/i.test(buyerHeader.trim())
      ? buyerHeader.trim().toLowerCase()
      : undefined;
  const receiptCore = {
    action_id: actionId,
    amount_msats: challenge.amount_msats,
    ...(buyer_pubkey ? { buyer_pubkey } : {}),
    completed_at: completedAt,
    input_hash: inputHash,
    output_hash: outputHash,
    payment_hash: tokenBody.ph,
    receipt_id: `rcpt_${nanoid(12)}`,
    service_pubkey: publicKey,
  };
  const signature = signReceipt(receiptCore);
  const receipt = { ...receiptCore, signature };
  insertReceipt(receipt);
  publish({
    type: "receipt",
    data: receipt,
  });

  return NextResponse.json(
    {
      output: result.output,
      receipt,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

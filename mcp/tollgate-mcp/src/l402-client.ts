/**
 * L402 client — handles 402 challenge parsing and Authorization-header retry.
 * Wire format follows bLIP-26.
 */

export type Challenge = {
  token: string;
  invoice: string;
  amount_msats?: number;
  payment_hash?: string;
};

type ChallengeBody = {
  token?: string;
  invoice?: string;
  amount_msats?: number;
  payment_hash?: string;
};

export function parseChallengeHeader(header: string): Challenge | null {
  const m = /macaroon="([^"]+)",\s*invoice="([^"]+)"/i.exec(header);
  if (!m) return null;
  return { token: m[1], invoice: m[2] };
}

export async function parseChallengeFromResponse(res: Response): Promise<Challenge> {
  // Prefer header, fall back to body (which our publisher sends as JSON).
  const auth = res.headers.get("www-authenticate");
  if (auth) {
    const fromHeader = parseChallengeHeader(auth);
    if (fromHeader) {
      try {
        const body = (await res.clone().json()) as ChallengeBody;
        return {
          ...fromHeader,
          amount_msats: body.amount_msats,
          payment_hash: body.payment_hash,
        };
      } catch {
        return fromHeader;
      }
    }
  }
  const body = (await res.json()) as ChallengeBody;
  if (!body?.token || !body?.invoice) {
    throw new Error("server returned 402 but no parseable L402 challenge");
  }
  return {
    token: body.token,
    invoice: body.invoice,
    amount_msats: body.amount_msats,
    payment_hash: body.payment_hash,
  };
}

export function buildAuthorizationHeader(token: string, preimageHex: string): string {
  return `L402 ${token}:${preimageHex}`;
}

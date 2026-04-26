import { NWCClient } from "@getalby/sdk";
import type {
  WalletBackend,
  WalletBalance,
  CreateInvoiceParams,
  CreatedInvoice,
  PayInvoiceParams,
  PayInvoiceResult,
  InvoiceLookupResult,
  ReceiveAddressResult,
} from "@agents402/core";

/**
 * Backend wrapping a Nostr-Wallet-Connect connection (NIP-47).
 *
 * Holds the connection URI in memory for the life of the backend. Treats
 * connection drops by lazily reconnecting on next call. Doesn't expose the
 * URI through any of the WalletBackend methods — callers manage credentials
 * out of band.
 */
export class NwcWalletBackend implements WalletBackend {
  readonly provider = "nwc";

  private client: NWCClient | null = null;
  private nostrWalletConnectUrl: string;
  private displayLightningAddress?: string;

  constructor(opts: {
    nostr_wallet_connect_url: string;
    /** Optional human-friendly LN address for getReceiveAddress display. */
    lightning_address?: string;
  }) {
    this.nostrWalletConnectUrl = opts.nostr_wallet_connect_url;
    this.displayLightningAddress = opts.lightning_address;
  }

  private c(): NWCClient {
    if (!this.client) {
      this.client = new NWCClient({ nostrWalletConnectUrl: this.nostrWalletConnectUrl });
    }
    return this.client;
  }

  async getBalance(): Promise<WalletBalance> {
    const r = await this.c().getBalance();
    return { confirmed_msats: r.balance, spendable_msats: r.balance, unit: "msat" };
  }

  async createInvoice(params: CreateInvoiceParams): Promise<CreatedInvoice> {
    const expiry = params.expiry_seconds ?? 900;
    const tryOnce = async () => {
      return this.c().makeInvoice({
        amount: params.amount_msats,
        description: params.description ?? "agents402:invoice",
        expiry,
      });
    };
    let result;
    try {
      result = await tryOnce();
    } catch (e) {
      // Drop the cached client and retry once with a fresh connection.
      this.client = null;
      result = await tryOnce();
    }
    return {
      invoice: result.invoice,
      payment_hash: result.payment_hash,
      expires_at: result.expires_at,
      amount_msats: params.amount_msats,
    };
  }

  async payInvoice(params: PayInvoiceParams): Promise<PayInvoiceResult> {
    const r = await this.c().payInvoice({ invoice: params.invoice });
    // Coinos and some Primal flows return a UUID-shaped string here instead of a
    // 64-char hex preimage. Callers who need cryptographic verification fall
    // back to lookupInvoice in that case.
    return {
      payment_hash: undefined, // NIP-47 pay_invoice doesn't return payment_hash
      preimage: r.preimage,
      amount_msats: 0, // not echoed by NWC; caller knows from BOLT11
      fee_msats: r.fees_paid ?? 0,
      status: "succeeded",
      raw: r,
    };
  }

  async lookupInvoice(payment_hash: string): Promise<InvoiceLookupResult> {
    try {
      const r = await this.c().lookupInvoice({ payment_hash });
      const stateMap: Record<string, InvoiceLookupResult["state"]> = {
        settled: "settled",
        pending: "pending",
        accepted: "pending",
        failed: "failed",
        expired: "expired",
      };
      return {
        payment_hash,
        state: stateMap[r.state] ?? "unknown",
        amount_msats: r.amount,
        settled_at: r.settled_at,
      };
    } catch {
      return { payment_hash, state: "unknown" };
    }
  }

  async getReceiveAddress(): Promise<ReceiveAddressResult> {
    if (this.displayLightningAddress) {
      return { address: this.displayLightningAddress, type: "lightning_address" };
    }
    // No address known — return the placeholder. Caller can show "Use NWC `make_invoice`".
    return { address: "(create an invoice via this wallet)", type: "lightning_address" };
  }

  async dispose(): Promise<void> {
    this.client = null;
  }
}

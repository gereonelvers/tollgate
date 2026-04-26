import type {
  WalletBackend,
  WalletBalance,
  CreateInvoiceParams,
  CreatedInvoice,
  PayInvoiceParams,
  PayInvoiceResult,
  InvoiceLookupResult,
  ReceiveAddressResult,
  WalletExport,
} from "@agents402/core";

/**
 * In-memory fake wallet for testing. Generates fake BOLT11 invoices and pays
 * them with a fake preimage. Tracks balance + invoice state in memory.
 *
 * Intended for:
 *   - End-to-end test flows that exercise the protocol without real Lightning
 *   - Web UI development before wiring a real backend
 *   - CI / unit tests
 *
 * NOT intended for production. The dev-fake provider tag is the agent's hint
 * that this wallet is non-real and any "payments" are fictional.
 */
export class DevFakeWalletBackend implements WalletBackend {
  readonly provider = "dev-fake";

  private balanceMsats: number;
  private invoices = new Map<
    string,
    { amount_msats: number; expires_at: number; settled_at: number | null; description?: string }
  >();
  private nextHashCounter = 0;

  constructor(opts: { initial_balance_msats?: number } = {}) {
    this.balanceMsats = opts.initial_balance_msats ?? 100_000;
  }

  /** Convenience: drop sats in (e.g., simulating a sponsor faucet). */
  credit(amount_msats: number): void {
    this.balanceMsats += amount_msats;
  }

  async getBalance(): Promise<WalletBalance> {
    return {
      confirmed_msats: this.balanceMsats,
      spendable_msats: this.balanceMsats,
      unit: "msat",
    };
  }

  async createInvoice(params: CreateInvoiceParams): Promise<CreatedInvoice> {
    const payment_hash = this.makeFakeHash("hash");
    const expiry = params.expiry_seconds ?? 900;
    const expires_at = Math.floor(Date.now() / 1000) + expiry;
    this.invoices.set(payment_hash, {
      amount_msats: params.amount_msats,
      expires_at,
      settled_at: null,
      description: params.description,
    });
    const fakeBolt11 = `lnbcfake${params.amount_msats}n1${payment_hash.slice(0, 32)}`;
    return {
      invoice: fakeBolt11,
      payment_hash,
      expires_at,
      amount_msats: params.amount_msats,
    };
  }

  async payInvoice(params: PayInvoiceParams): Promise<PayInvoiceResult> {
    // Naively parse amount from our fake invoice format; otherwise default 0.
    const m = /^lnbcfake(\d+)n1/.exec(params.invoice);
    const amount_msats = m ? Number(m[1]) : 0;
    if (this.balanceMsats < amount_msats) {
      return {
        amount_msats,
        status: "failed",
        raw: { reason: "insufficient_balance", balance: this.balanceMsats },
      };
    }
    this.balanceMsats -= amount_msats;
    const preimage = this.makeFakeHash("preimage");
    const payment_hash = this.makeFakeHash("paidhash");
    return {
      payment_hash,
      preimage,
      amount_msats,
      fee_msats: 0,
      status: "succeeded",
      raw: { provider: this.provider, fake: true },
    };
  }

  /**
   * In dev-fake mode, calling lookupInvoice immediately marks the invoice as
   * settled — the test harness uses this to simulate "the agent paid; the
   * publisher's wallet has now seen the payment land."
   */
  async lookupInvoice(payment_hash: string): Promise<InvoiceLookupResult> {
    const inv = this.invoices.get(payment_hash);
    if (!inv) return { payment_hash, state: "unknown" };
    if (!inv.settled_at) inv.settled_at = Math.floor(Date.now() / 1000);
    return {
      payment_hash,
      state: "settled",
      amount_msats: inv.amount_msats,
      settled_at: inv.settled_at,
    };
  }

  async getReceiveAddress(): Promise<ReceiveAddressResult> {
    return { address: "devfake@localhost", type: "lightning_address" };
  }

  async exportWallet(): Promise<WalletExport> {
    return {
      provider: this.provider,
      encrypted_secret: "(none — dev-fake wallet has no secret to back up)",
      encryption: "none",
      public_identifier: "dev-fake-wallet",
      warning: "DevFakeWalletBackend is not a real wallet. Funds are imaginary.",
      created_at: new Date().toISOString(),
    };
  }

  private makeFakeHash(salt: string): string {
    this.nextHashCounter++;
    const seed = `${salt}-${this.nextHashCounter}-${Date.now()}-${Math.random()}`;
    // Simple fake 32-byte hex (not cryptographically meaningful)
    let h = "";
    for (let i = 0; i < 64; i++) {
      h += ((seed.charCodeAt(i % seed.length) + i) % 16).toString(16);
    }
    return h;
  }
}

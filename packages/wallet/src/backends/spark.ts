import { SparkWallet, Network } from "@buildonspark/spark-sdk";
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

type NetworkName = "MAINNET" | "TESTNET" | "SIGNET" | "REGTEST" | "LOCAL";

/**
 * Node-side Spark wallet backed by a BIP-39 mnemonic. The same mnemonic that
 * was generated in the browser onboarding flow can be re-imported here, so
 * MCP server payments use the same self-custodial wallet the user holds.
 *
 * This backend treats the Spark SSP (Spark Service Provider) as the source
 * of inbound liquidity for Lightning receives — no channel-open dance.
 *
 * Sats math: Spark SDK uses sats; the WalletBackend interface uses msats.
 * We convert at the boundary.
 */
export class SparkWalletBackend implements WalletBackend {
  readonly provider = "spark";

  private wallet: SparkWallet | null = null;
  private mnemonic: string;
  private network: NetworkName;

  constructor(opts: { mnemonic: string; network?: NetworkName }) {
    this.mnemonic = opts.mnemonic.trim();
    this.network = opts.network ?? "MAINNET";
  }

  async initialize(): Promise<void> {
    if (this.wallet) return;
    const result = await SparkWallet.initialize({
      mnemonicOrSeed: this.mnemonic,
      options: { network: Network[this.network] as unknown as NetworkName },
    });
    this.wallet = result.wallet as SparkWallet;
  }

  private async w(): Promise<SparkWallet> {
    if (!this.wallet) await this.initialize();
    if (!this.wallet) throw new Error("SparkWalletBackend failed to initialize");
    return this.wallet;
  }

  async getBalance(): Promise<WalletBalance> {
    const w = await this.w();
    const r = (await w.getBalance()) as { balance?: bigint | number };
    const sats = typeof r.balance === "bigint" ? Number(r.balance) : (r.balance ?? 0);
    const msats = sats * 1000;
    return { confirmed_msats: msats, spendable_msats: msats, unit: "msat" };
  }

  async createInvoice(params: CreateInvoiceParams): Promise<CreatedInvoice> {
    const w = await this.w();
    const sats = Math.max(1, Math.floor(params.amount_msats / 1000));
    const r = (await w.createLightningInvoice({
      amountSats: sats,
      memo: params.description,
    })) as {
      invoice: { encodedInvoice: string; paymentHash?: string };
      id: string;
    };
    return {
      invoice: r.invoice.encodedInvoice,
      payment_hash: r.invoice.paymentHash ?? "",
      expires_at: Math.floor(Date.now() / 1000) + (params.expiry_seconds ?? 900),
      amount_msats: sats * 1000,
    };
  }

  async payInvoice(params: PayInvoiceParams): Promise<PayInvoiceResult> {
    const w = await this.w();
    const maxFeeSats =
      typeof params.max_fee_msats === "number"
        ? Math.max(0, Math.floor(params.max_fee_msats / 1000))
        : 5;
    const r = (await w.payLightningInvoice({
      invoice: params.invoice,
      maxFeeSats,
    })) as { id: string };

    // Spark settles asynchronously through its operator network. Poll for the preimage.
    let preimage: string | undefined;
    let amountSats = 0;
    let feeSats = 0;
    for (let i = 0; i < 12; i++) {
      const state = (await (
        w as unknown as {
          getLightningSendRequest(id: string): Promise<{
            paymentPreimage?: string;
            amountSats?: number;
            feeSats?: number;
            status?: string;
          } | null>;
        }
      ).getLightningSendRequest(r.id)) ?? null;
      if (state?.paymentPreimage) {
        preimage = state.paymentPreimage;
        amountSats = state.amountSats ?? 0;
        feeSats = state.feeSats ?? 0;
        break;
      }
      if (state?.status === "FAILED") {
        return {
          amount_msats: 0,
          status: "failed",
          raw: state,
        };
      }
      await new Promise((res) => setTimeout(res, 800));
    }

    return {
      preimage,
      amount_msats: amountSats * 1000,
      fee_msats: feeSats * 1000,
      status: preimage ? "succeeded" : "pending",
      raw: { send_request_id: r.id },
    };
  }

  async lookupInvoice(payment_hash: string): Promise<InvoiceLookupResult> {
    // Spark indexes by request id (returned at create time), not by payment_hash
    // directly. For now we surface "unknown" and let the caller fall back to
    // wallet balance comparison or an idempotency-based check.
    return { payment_hash, state: "unknown" };
  }

  async getReceiveAddress(): Promise<ReceiveAddressResult> {
    const w = await this.w();
    const addr = String(await w.getSparkAddress());
    return { address: addr, type: "spark" };
  }

  async dispose(): Promise<void> {
    this.wallet = null;
  }
}

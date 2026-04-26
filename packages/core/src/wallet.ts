/**
 * Wallet backend interface — provider-agnostic. The MCP server, the web
 * wallet UI, and the test harness all consume this contract; concrete
 * implementations live in @agents402/wallet/backends/*.
 *
 * Design constraints:
 *   - Wallet secrets MUST never leave the backend implementation. Callers
 *     work with this interface; no method here returns or accepts a raw
 *     mnemonic / seed / private key.
 *   - All amounts are millisatoshis. Lightning's smallest unit, integer math.
 *   - All methods are async. Implementations may be local (in-process) or
 *     remote (RPC to a wallet daemon); callers don't need to know.
 */

export interface WalletBalance {
  /** Confirmed spendable balance, in millisatoshis. */
  confirmed_msats: number;
  /** Available for outgoing payments after fees and reserves. */
  spendable_msats: number;
  unit: "msat";
}

export interface CreateInvoiceParams {
  amount_msats: number;
  description?: string;
  /** Seconds until the invoice expires. Default 900 (15 min). */
  expiry_seconds?: number;
}

export interface CreatedInvoice {
  /** BOLT11 string. */
  invoice: string;
  /** Hex payment hash; agents pay this and prove with the preimage. */
  payment_hash: string;
  /** Unix seconds. */
  expires_at: number;
  /** Echoed-back amount for safety. */
  amount_msats: number;
}

export interface PayInvoiceParams {
  /** BOLT11 invoice. */
  invoice: string;
  /** Soft cap on routing fee. Implementations MAY ignore. */
  max_fee_msats?: number;
  metadata?: {
    purpose?: string;
    quote_id?: string;
    service_domain?: string;
    action_id?: string;
  };
}

export interface PayInvoiceResult {
  payment_hash?: string;
  /**
   * 32-byte preimage in lowercase hex IF the wallet exposes it. Some custodial
   * NWC implementations (Coinos, parts of Primal) return only an opaque ID
   * here; agents402 verification falls back to wallet lookup in that case.
   */
  preimage?: string;
  amount_msats: number;
  fee_msats?: number;
  status: "succeeded" | "pending" | "failed";
  /** Echo of provider-specific raw response, for debugging. */
  raw?: unknown;
}

export interface InvoiceLookupResult {
  payment_hash: string;
  state: "settled" | "pending" | "failed" | "expired" | "unknown";
  amount_msats?: number;
  settled_at?: number;
}

export interface ReceiveAddressResult {
  /** Bare address or Lightning Address depending on `type`. */
  address: string;
  type: "lightning_address" | "spark" | "bitcoin";
}

/**
 * Optional: encrypted backup blob. Implementations that don't support export
 * (e.g. NWC) can omit this method. Implementations that DO support it MUST
 * encrypt the secret before returning; the warning string MUST be present
 * and human-readable.
 */
export interface WalletExport {
  provider: string;
  encrypted_secret: string;
  encryption: "webcrypto-aes-gcm-pbkdf2" | "none";
  /** Pubkey, BIP39 word count, or other public identifier — never the secret. */
  public_identifier?: string;
  warning: string;
  created_at: string;
}

export interface WalletBackend {
  /** Stable provider tag. e.g. "spark" | "nwc" | "dev-fake". */
  readonly provider: string;

  /**
   * Optional. Called once before the first method call. Implementations may
   * use this for SDK init, key derivation, etc. Idempotent.
   */
  initialize?(): Promise<void>;

  getBalance(): Promise<WalletBalance>;

  createInvoice(params: CreateInvoiceParams): Promise<CreatedInvoice>;

  payInvoice(params: PayInvoiceParams): Promise<PayInvoiceResult>;

  /** Lookup an inbound invoice by payment hash. Used by L402 settle confirmation. */
  lookupInvoice?(payment_hash: string): Promise<InvoiceLookupResult>;

  /** A receive identifier for the user UI (lightning address, spark address...). */
  getReceiveAddress?(): Promise<ReceiveAddressResult>;

  /** Encrypted backup of the secret. */
  exportWallet?(): Promise<WalletExport>;

  /** Optional graceful shutdown / connection cleanup. */
  dispose?(): Promise<void>;
}

/**
 * Client-side persistent state for the wallet onboarding flow.
 *
 * Stored in localStorage as a single JSON blob. NOT encrypted — user is
 * trusting their browser's storage. We surface this caveat in the UI.
 *
 * Schema is versioned; future changes can migrate.
 */

const STORAGE_KEY = "faregate.wallet.v1";

export type StoredWallet = {
  version: 1;
  created_at: string;
  /** Provider tag. */
  provider: "nwc" | "dev-fake" | "spark";
  /** Display label shown to the user. */
  label?: string;
  /** Connection URI for NWC backends. Treat as a secret. */
  nwc_url?: string;
  /** BIP-39 mnemonic for Spark wallets. v1 plaintext; encrypt in v2. SECRET. */
  spark_mnemonic?: string;
  /** Spark network — defaults to MAINNET. */
  spark_network?: "MAINNET" | "REGTEST" | "SIGNET" | "TESTNET";
  /** Cached Spark address — convenient for showing in UI without re-init. */
  spark_address?: string;
  /** Cached Spark identity pubkey hex. */
  spark_identity_pubkey?: string;
  /** Optional Lightning address shown to the user for receive. */
  lightning_address?: string;
  /** Whether the user accepted that we don't custody their funds. */
  accepted_self_custody: boolean;
  /** Whether the user confirmed they wrote down the mnemonic. Spark only. */
  backup_confirmed: boolean;
  /** Whether the user has claimed the sponsor faucet. */
  sponsor_claimed: boolean;
  /** Saved spend policy. */
  policy: {
    daily_budget_msats: number;
    max_per_action_msats: number;
    require_confirm_above_msats: number;
    new_service_max_msats: number;
    allowed_action_types: string[];
    blocked_domains: string[];
    trusted_domains: string[];
    min_network_reputation: number;
    min_reputation_sample_size: number;
    rater_min_distinct_services: number;
    rater_full_weight_at_distinct_services: number;
  };
};

export const DEFAULT_POLICY: StoredWallet["policy"] = {
  daily_budget_msats: 50_000,
  max_per_action_msats: 10_000,
  require_confirm_above_msats: 5_000,
  new_service_max_msats: 2_000,
  allowed_action_types: ["web_access", "structured_data", "site_agent_query", "verification"],
  blocked_domains: [],
  trusted_domains: [],
  min_network_reputation: 0,
  min_reputation_sample_size: 0,
  rater_min_distinct_services: 1,
  rater_full_weight_at_distinct_services: 3,
};

export function loadWallet(): StoredWallet | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWallet;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWallet(w: StoredWallet): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
}

export function clearWallet(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function isValidNwcUrl(s: string): boolean {
  return /^nostr\+walletconnect:\/\/[0-9a-f]{64}\?/.test(s.trim());
}

/**
 * Extract the lightning address (`lud16` query param) from an NWC URI, if present.
 * Used for "where can I receive sats?" UI.
 */
export function extractLnAddressFromNwc(nwc: string): string | undefined {
  try {
    const url = new URL(nwc);
    const lud16 = url.searchParams.get("lud16");
    return lud16 ?? undefined;
  } catch {
    return undefined;
  }
}

export function newDevFakeWallet(label = "Demo wallet"): StoredWallet {
  return {
    version: 1,
    created_at: new Date().toISOString(),
    provider: "dev-fake",
    label,
    accepted_self_custody: true,
    backup_confirmed: true, // no real backup needed
    sponsor_claimed: false,
    policy: DEFAULT_POLICY,
  };
}

export function newNwcWallet(nwcUrl: string, label?: string): StoredWallet {
  return {
    version: 1,
    created_at: new Date().toISOString(),
    provider: "nwc",
    label: label ?? "My wallet",
    nwc_url: nwcUrl,
    lightning_address: extractLnAddressFromNwc(nwcUrl),
    accepted_self_custody: true,
    backup_confirmed: true, // user manages their own NWC wallet's backup
    sponsor_claimed: false,
    policy: DEFAULT_POLICY,
  };
}

export function newSparkWallet(opts: {
  mnemonic: string;
  network?: StoredWallet["spark_network"];
  address?: string;
  identity_pubkey?: string;
  label?: string;
}): StoredWallet {
  return {
    version: 1,
    created_at: new Date().toISOString(),
    provider: "spark",
    label: opts.label ?? "Spark wallet",
    spark_mnemonic: opts.mnemonic,
    spark_network: opts.network ?? "MAINNET",
    spark_address: opts.address,
    spark_identity_pubkey: opts.identity_pubkey,
    accepted_self_custody: true,
    backup_confirmed: false, // user must confirm before we route money to it
    sponsor_claimed: false,
    policy: DEFAULT_POLICY,
  };
}

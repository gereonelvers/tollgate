"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadWallet,
  saveWallet,
  clearWallet,
  type StoredWallet,
} from "@/lib/storage";
import { formatSats } from "@/lib/format";

type Balance = { confirmed_msats: number; spendable_msats: number; unit: "msat" } | null;

export function WalletDashboard() {
  const [wallet, setWallet] = useState<StoredWallet | null>(null);
  const [balance, setBalance] = useState<Balance>(null);
  const [balanceErr, setBalanceErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [showRevealUri, setShowRevealUri] = useState(false);
  const [showMcp, setShowMcp] = useState(true);

  useEffect(() => {
    const w = loadWallet();
    setWallet(w);
    setHydrated(true);
    if (!w) return;
    if (w.provider === "dev-fake") {
      // Mock balance for the demo
      setBalance({
        confirmed_msats: w.sponsor_claimed ? 150_000 : 100_000,
        spendable_msats: w.sponsor_claimed ? 150_000 : 100_000,
        unit: "msat",
      });
    } else if (w.provider === "nwc" && w.nwc_url) {
      loadNwcBalance(w.nwc_url).then(
        (r) => setBalance(r),
        (e) => setBalanceErr(e?.message ?? String(e)),
      );
    } else if (w.provider === "spark" && w.spark_mnemonic) {
      loadSparkBalance(w).then(
        (msats) =>
          setBalance({ confirmed_msats: msats, spendable_msats: msats, unit: "msat" }),
        (e) => setBalanceErr(e?.message ?? String(e)),
      );
    }
  }, []);

  if (!hydrated) {
    return <Skel label="loading…" />;
  }
  if (!wallet) {
    return (
      <section className="border-b hairline">
        <div className="mx-auto max-w-[900px] px-6 sm:px-10 py-24">
          <h1 className="display text-[clamp(28px,4vw,40px)] text-zinc-950">
            No wallet configured.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)]">
            Pick a setup path to get started.
          </p>
          <Link
            href="/"
            className="mt-8 inline-block border hairline bg-zinc-950 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition"
          >
            Go to setup →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="border-b hairline">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">
              Wallet · {providerLabel(wallet.provider)}
            </div>
            <div className="label text-[var(--text-4)]">
              created {new Date(wallet.created_at).toLocaleDateString()}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-x-8 py-12">
            <div className="col-span-12 lg:col-span-7">
              <div className="label text-[var(--text-3)]">Balance</div>
              <div className="mt-3 display tabular text-[clamp(48px,7vw,84px)] text-zinc-950">
                {balance ? formatSats(balance.confirmed_msats) : balanceErr ? "—" : "…"}
              </div>
              {balanceErr && (
                <div className="mt-2 font-mono text-[12px] text-rose-700">
                  Couldn&apos;t reach wallet: {balanceErr}
                </div>
              )}
              {wallet.lightning_address && (
                <div className="mt-6 flex flex-wrap items-baseline gap-2">
                  <span className="label text-[var(--text-3)]">Receive at</span>
                  <code className="font-mono text-[14px] text-zinc-950">{wallet.lightning_address}</code>
                </div>
              )}
            </div>

            <div className="col-span-12 lg:col-span-5 mt-8 lg:mt-0">
              <div className="border hairline bg-[var(--surface)] p-6">
                <div className="label text-[var(--text-3)]">Sponsor faucet</div>
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-2)]">
                  {wallet.sponsor_claimed
                    ? "You've already claimed your starter sats. Top up from any other Lightning wallet."
                    : "First-time wallets are eligible for a small starter grant. ~50 sats, sponsored by us."}
                </p>
                <SponsorButton
                  wallet={wallet}
                  onClaimed={(claimed) => {
                    const next = { ...wallet, sponsor_claimed: claimed };
                    saveWallet(next);
                    setWallet(next);
                    if (next.provider === "dev-fake") {
                      setBalance({
                        confirmed_msats: 150_000,
                        spendable_msats: 150_000,
                        unit: "msat",
                      });
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b hairline">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">Activity</div>
            <div className="label text-[var(--text-4)]">last 20 · live from your wallet provider</div>
          </div>
          <div className="py-10">
            <PaymentHistory wallet={wallet} />
          </div>
        </div>
      </section>

      <section className="border-b hairline">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">Spend policy</div>
            <div className="label text-[var(--text-4)]">enforced in code, not by the model</div>
          </div>
          <div className="py-12">
            <PolicyEditor wallet={wallet} onChange={(p) => {
              const next = { ...wallet, policy: p };
              saveWallet(next);
              setWallet(next);
            }} />
          </div>
        </div>
      </section>

      <section className="border-b hairline">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <button
              onClick={() => setShowMcp((s) => !s)}
              className="label text-[var(--text-3)] hover:text-zinc-950 transition"
            >
              {showMcp ? "▼" : "▶"} MCP config
            </button>
            <div className="label text-[var(--text-4)]">drop into Claude Code or Claude Desktop</div>
          </div>
          {showMcp && (
            <div className="py-10">
              <McpConfig wallet={wallet} reveal={showRevealUri} setReveal={setShowRevealUri} />
            </div>
          )}
        </div>
      </section>

      <section className="border-b hairline">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-10 py-10">
          <div className="flex items-center justify-between">
            <Link href="/developer" className="text-[13px] text-[var(--text-3)] hover:text-zinc-950 transition">
              Developer settings →
            </Link>
            <button
              type="button"
              onClick={() => {
                if (confirm("Forget this wallet config? Your actual wallet at the provider is unaffected.")) {
                  clearWallet();
                  setWallet(null);
                }
              }}
              className="text-[13px] text-rose-700 hover:text-rose-900 transition"
            >
              Forget this wallet
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

/* ----------------------------------------------------------------------- */

function Skel({ label }: { label: string }) {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-[900px] px-6 py-24 sm:px-10">
        <div className="font-mono text-[12px] text-[var(--text-3)]">{label}</div>
      </div>
    </section>
  );
}

function providerLabel(p: StoredWallet["provider"]): string {
  if (p === "nwc") return "Nostr Wallet Connect";
  if (p === "spark") return "Spark · self-custodial";
  return "Demo (no real sats)";
}

async function loadNwcBalance(nwcUrl: string): Promise<Balance> {
  const { NWCClient } = await import("@getalby/sdk");
  const c = new NWCClient({ nostrWalletConnectUrl: nwcUrl });
  const r = await c.getBalance();
  return { confirmed_msats: r.balance, spendable_msats: r.balance, unit: "msat" };
}

async function loadSparkBalance(stored: StoredWallet): Promise<number> {
  const { getSparkBalance } = await import("@/lib/spark");
  return getSparkBalance(stored);
}

type WalletTx = {
  id: string;
  direction: "in" | "out";
  amount_msats: number;
  fees_msats?: number;
  description?: string;
  created_at: number;
  state: "settled" | "pending" | "failed";
};

async function loadNwcHistory(nwcUrl: string, limit = 20): Promise<WalletTx[]> {
  const { NWCClient } = await import("@getalby/sdk");
  const c = new NWCClient({ nostrWalletConnectUrl: nwcUrl });
  const r = (await c.listTransactions({ limit })) as {
    transactions?: Array<{
      type?: string;
      payment_hash?: string;
      preimage?: string;
      invoice?: string;
      description?: string;
      description_hash?: string;
      amount?: number;
      fees_paid?: number;
      created_at?: number;
      settled_at?: number;
      expires_at?: number;
    }>;
  };
  const now = Math.floor(Date.now() / 1000);
  return (r.transactions ?? []).map((t) => {
    const created = t.settled_at ?? t.created_at ?? now;
    const state: WalletTx["state"] = t.settled_at
      ? "settled"
      : (t.expires_at ?? Infinity) < now
        ? "failed"
        : "pending";
    return {
      id: String(t.payment_hash ?? t.preimage ?? created),
      direction: t.type === "incoming" ? "in" : "out",
      amount_msats: t.amount ?? 0,
      fees_msats: t.fees_paid,
      description: t.description?.trim() || undefined,
      created_at: created,
      state,
    };
  });
}

function PaymentHistory({ wallet }: { wallet: StoredWallet }) {
  const [txs, setTxs] = useState<WalletTx[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTxs(null);
    setErr(null);
    if (wallet.provider === "dev-fake") {
      // Demo wallet has no real history.
      setTxs([]);
      return;
    }
    if (wallet.provider === "nwc" && wallet.nwc_url) {
      loadNwcHistory(wallet.nwc_url).then(
        (r) => setTxs(r),
        (e) => setErr(e?.message ?? String(e)),
      );
      return;
    }
    if (wallet.provider === "spark" && wallet.spark_mnemonic) {
      (async () => {
        const { getSparkHistory } = await import("@/lib/spark");
        return getSparkHistory(wallet);
      })().then(
        (r) => setTxs(r),
        (e) => setErr(e?.message ?? String(e)),
      );
      return;
    }
  }, [wallet]);

  if (txs === null && !err) {
    return (
      <div className="font-mono text-[12.5px] text-[var(--text-3)]">
        loading activity…
      </div>
    );
  }
  if (err) {
    return (
      <div className="border hairline bg-rose-50 px-5 py-4">
        <div className="label text-rose-800">Couldn&apos;t load activity</div>
        <p className="mt-2 font-mono text-[12.5px] text-rose-900">{err}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-rose-900">
          Some wallet providers don&apos;t expose <code>list_transactions</code>{" "}
          over NWC. Try checking history in the wallet&apos;s native app.
        </p>
      </div>
    );
  }
  if (!txs || txs.length === 0) {
    return (
      <div className="border hairline bg-[var(--surface)] px-5 py-6 text-center">
        <div className="label text-[var(--text-3)]">No payments yet</div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-2)]">
          {wallet.provider === "dev-fake"
            ? "Demo wallets don't track real history. Connect a real wallet to see paid actions land here."
            : "Once your agent makes a paid call, the receipt appears here within a few seconds."}
        </p>
      </div>
    );
  }
  return (
    <div className="border hairline">
      <div className="grid grid-cols-12 gap-2 border-b hairline bg-[var(--surface)] px-4 py-2.5 label text-[var(--text-3)]">
        <div className="col-span-2">When</div>
        <div className="col-span-1">Dir</div>
        <div className="col-span-2 text-right">Amount</div>
        <div className="col-span-6">Memo</div>
        <div className="col-span-1 text-right">State</div>
      </div>
      {txs.map((t, i) => (
        <div
          key={t.id + i}
          className={`grid grid-cols-12 items-center gap-2 px-4 py-3 ${
            i < txs.length - 1 ? "border-b hairline" : ""
          }`}
        >
          <div className="col-span-2 font-mono text-[12px] text-[var(--text-3)]">
            {timeAgo(t.created_at)}
          </div>
          <div className="col-span-1">
            {t.direction === "in" ? (
              <span className="inline-flex items-center justify-center border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-800">
                in
              </span>
            ) : (
              <span className="inline-flex items-center justify-center border hairline bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-2)]">
                out
              </span>
            )}
          </div>
          <div className="col-span-2 text-right">
            <div className="font-mono text-[14px] tabular text-zinc-950">
              {formatSats(t.amount_msats)}
            </div>
            {t.fees_msats ? (
              <div className="mt-0.5 font-mono text-[10.5px] text-[var(--text-4)] tabular">
                + {formatSats(t.fees_msats)} fee
              </div>
            ) : null}
          </div>
          <div className="col-span-6 truncate font-mono text-[12.5px] text-[var(--text-2)]">
            {t.description ?? <span className="italic text-[var(--text-4)]">no memo</span>}
          </div>
          <div className="col-span-1 text-right">
            <StateTag state={t.state} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StateTag({ state }: { state: WalletTx["state"] }) {
  const cls =
    state === "settled"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : state === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-rose-200 bg-rose-50 text-rose-800";
  return (
    <span className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[10.5px] ${cls}`}>
      {state}
    </span>
  );
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${Math.max(0, diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function SponsorButton({
  wallet,
  onClaimed,
}: {
  wallet: StoredWallet;
  onClaimed: (b: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function claim() {
    setBusy(true);
    setMsg(null);
    try {
      // Demo wallet: just simulate
      if (wallet.provider === "dev-fake") {
        await new Promise((r) => setTimeout(r, 400));
        setMsg("✓ 50 sats credited (simulated)");
        onClaimed(true);
        return;
      }
      // Spark or NWC: ask the user's wallet for a 50-sat invoice; POST to /api/sponsor.
      let invoice: string;
      let payment_hash: string | undefined;
      if (wallet.provider === "nwc" && wallet.nwc_url) {
        const { NWCClient } = await import("@getalby/sdk");
        const c = new NWCClient({ nostrWalletConnectUrl: wallet.nwc_url });
        const inv = await c.makeInvoice({
          amount: 50_000,
          description: "Faregate sponsor faucet",
          expiry: 600,
        });
        invoice = inv.invoice;
        payment_hash = inv.payment_hash;
      } else if (wallet.provider === "spark" && wallet.spark_mnemonic) {
        const { createSparkLightningInvoice } = await import("@/lib/spark");
        const r = await createSparkLightningInvoice(wallet, {
          amountSats: 50,
          memo: "Faregate sponsor faucet",
        });
        invoice = r.encodedInvoice;
      } else {
        setMsg("Sponsor faucet is only available for Spark, NWC, and demo wallets.");
        return;
      }
      const r = await fetch("/api/sponsor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet_public_id:
            wallet.lightning_address ??
            wallet.spark_identity_pubkey ??
            "anon",
          invoice,
          payment_hash,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; reason?: string };
      if (!j.ok) {
        setMsg(`Couldn't sponsor: ${j.error ?? j.reason ?? "unknown error"}`);
        return;
      }
      setMsg("✓ 50 sats sent — check your wallet in a few seconds");
      onClaimed(true);
    } catch (e: unknown) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={claim}
        disabled={busy || wallet.sponsor_claimed}
        className="mt-5 w-full border hairline bg-zinc-950 px-4 py-3 text-[13.5px] font-medium text-white hover:bg-zinc-800 transition disabled:opacity-30 disabled:hover:bg-zinc-950"
      >
        {wallet.sponsor_claimed
          ? "Already claimed"
          : busy
            ? "Sending…"
            : "Claim starter sats →"}
      </button>
      {msg && (
        <div className="mt-3 font-mono text-[12px] text-[var(--text-2)]">{msg}</div>
      )}
    </>
  );
}

function PolicyEditor({
  wallet,
  onChange,
}: {
  wallet: StoredWallet;
  onChange: (policy: StoredWallet["policy"]) => void;
}) {
  const p = wallet.policy;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p);

  function save() {
    onChange(draft);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="grid grid-cols-2 gap-px border hairline bg-[var(--line)] sm:grid-cols-4">
        <PolicyCell label="Daily budget" value={formatSats(p.daily_budget_msats)} />
        <PolicyCell label="Max per action" value={formatSats(p.max_per_action_msats)} />
        <PolicyCell label="Approval above" value={formatSats(p.require_confirm_above_msats)} />
        <PolicyCell label="Unknown service cap" value={formatSats(p.new_service_max_msats)} />
        <PolicyCell label="Min reputation" value={p.min_network_reputation === 0 ? "off" : p.min_network_reputation.toFixed(2)} />
        <PolicyCell label="Min sample size" value={p.min_reputation_sample_size === 0 ? "off" : String(p.min_reputation_sample_size)} />
        <PolicyCell label="Allowed types" value={`${p.allowed_action_types.length}`} />
        <PolicyCell label="Trusted domains" value={`${p.trusted_domains.length}`} />
        <div className="col-span-2 sm:col-span-4 bg-[var(--bg)] px-5 py-4 flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              setDraft(p);
              setEditing(true);
            }}
            className="text-[13px] text-zinc-950 hover:underline"
          >
            Edit policy →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border hairline bg-white p-7">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <NumberField label="Daily budget (msats)" value={draft.daily_budget_msats} onChange={(v) => setDraft({ ...draft, daily_budget_msats: v })} />
        <NumberField label="Max per action (msats)" value={draft.max_per_action_msats} onChange={(v) => setDraft({ ...draft, max_per_action_msats: v })} />
        <NumberField label="Require approval above (msats)" value={draft.require_confirm_above_msats} onChange={(v) => setDraft({ ...draft, require_confirm_above_msats: v })} />
        <NumberField label="New service max (msats)" value={draft.new_service_max_msats} onChange={(v) => setDraft({ ...draft, new_service_max_msats: v })} />
        <NumberField label="Min network reputation (0–1)" value={draft.min_network_reputation} step={0.1} onChange={(v) => setDraft({ ...draft, min_network_reputation: Math.max(0, Math.min(1, v)) })} />
        <NumberField label="Min reputation sample size" value={draft.min_reputation_sample_size} onChange={(v) => setDraft({ ...draft, min_reputation_sample_size: Math.max(0, v | 0) })} />
        <NumberField label="Rater min distinct services" value={draft.rater_min_distinct_services} onChange={(v) => setDraft({ ...draft, rater_min_distinct_services: Math.max(0, v | 0) })} />
        <NumberField label="Rater full weight at" value={draft.rater_full_weight_at_distinct_services} onChange={(v) => setDraft({ ...draft, rater_full_weight_at_distinct_services: Math.max(1, v | 0) })} />
      </div>
      <div className="mt-6 flex items-center justify-end gap-3 border-t hairline pt-5">
        <button
          type="button"
          onClick={() => {
            setDraft(p);
            setEditing(false);
          }}
          className="text-[13px] text-[var(--text-3)] hover:text-zinc-950 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          className="border hairline bg-zinc-950 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition"
        >
          Save policy
        </button>
      </div>
    </div>
  );
}

function PolicyCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg)] px-5 py-4">
      <div className="label text-[var(--text-3)]">{label}</div>
      <div className="mt-2 font-mono tabular text-[18px] text-zinc-950">{value}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="label text-[var(--text-3)] mb-2">{label}</div>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border hairline bg-[var(--bg-2)] px-3 py-2.5 font-mono tabular text-[14px] text-zinc-950 focus:border-zinc-700 focus:outline-none"
      />
    </label>
  );
}

function McpConfig({
  wallet,
  reveal,
  setReveal,
}: {
  wallet: StoredWallet;
  reveal: boolean;
  setReveal: (b: boolean) => void;
}) {
  const isNwc = wallet.provider === "nwc" && Boolean(wallet.nwc_url);
  const visible = reveal || !isNwc;
  const nwcDisplay = isNwc
    ? visible
      ? wallet.nwc_url
      : maskedNwc(wallet.nwc_url ?? "")
    : "(not used for this wallet provider)";
  const config = {
    mcpServers: {
      faregate: {
        command: "npx",
        args: ["-y", "@agents402/mcp"],
        env: {
          AGENT_NWC_URL: nwcDisplay,
          ...(wallet.provider === "dev-fake" ? { FAREGATE_MOCK_LIGHTNING: "1" } : {}),
        },
      },
    },
  };
  const json = JSON.stringify(config, null, 2);
  return (
    <div className="border hairline bg-[var(--code-bg)]">
      <div className="flex items-center justify-between border-b border-[var(--code-line)] px-5 py-3">
        <div className="label text-zinc-400">~/.claude/.mcp.json (excerpt)</div>
        <div className="flex items-center gap-3">
          {isNwc && (
            <button
              onClick={() => setReveal(!reveal)}
              className="font-mono text-[11px] text-zinc-500 hover:text-zinc-300 transition"
            >
              {reveal ? "hide secret" : "reveal secret"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const c = {
                mcpServers: {
                  faregate: {
                    command: "npx",
                    args: ["-y", "@agents402/mcp"],
                    env: {
                      AGENT_NWC_URL: wallet.nwc_url ?? "",
                      ...(wallet.provider === "dev-fake" ? { FAREGATE_MOCK_LIGHTNING: "1" } : {}),
                    },
                  },
                },
              };
              navigator.clipboard.writeText(JSON.stringify(c, null, 2)).catch(() => {});
            }}
            className="border border-zinc-700 px-2 py-1 font-mono text-[11px] text-zinc-200 hover:bg-zinc-800 transition"
          >
            copy real config
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto px-5 py-4 text-[12.5px] leading-[1.7] font-mono text-zinc-300">
        {json}
      </pre>
      <div className="border-t border-[var(--code-line)] px-5 py-3 font-mono text-[11px] text-zinc-500">
        {isNwc
          ? "Anyone with the AGENT_NWC_URL can spend up to its budget. Treat the copied config as a secret."
          : "Demo mode uses FAREGATE_MOCK_LIGHTNING=1; the npx command resolves the latest @agents402/mcp from npm on first run."}
      </div>
    </div>
  );
}

function maskedNwc(s: string): string {
  if (s.length < 60) return s;
  return s.replace(/secret=[0-9a-f]+/, "secret=•••redacted•••");
}

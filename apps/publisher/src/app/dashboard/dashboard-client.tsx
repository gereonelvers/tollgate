"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Receipt = {
  receipt_id: string;
  action_id: string;
  amount_msats: number;
  payment_hash: string;
  input_hash: string;
  output_hash: string;
  completed_at: string;
  service_pubkey: string;
  signature: string;
  created_at: number;
};

type ChallengeIssued = {
  action_id: string;
  amount_msats: number;
  payment_hash: string;
  invoice: string;
};

type FeedItem =
  | { kind: "challenge"; ts: number; data: ChallengeIssued }
  | { kind: "receipt"; ts: number; data: Receipt };

type Stats = {
  total_revenue_msats: number;
  by_action: Array<{ action_id: string; count: number; total_msats: number }>;
  receipts: Receipt[];
};

const formatSats = (msats: number) => {
  const sats = msats / 1000;
  if (sats < 1) return `${msats.toLocaleString()} msat`;
  if (sats < 1000) return `${sats.toLocaleString(undefined, { maximumFractionDigits: 1 })} sat`;
  return `${(sats / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })}k sat`;
};

const shortHash = (s: string, n = 6) =>
  s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-n)}` : s;

const since = (ts: number) => {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [streamLive, setStreamLive] = useState(false);
  const [, setTick] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const refetchStats = async () => {
    try {
      const r = await fetch("/api/receipts", { cache: "no-store" });
      if (r.ok) setStats(await r.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refetchStats();
    fetch("/api/mode", { cache: "no-store" })
      .then((r) => r.json())
      .then((m) => setMockMode(Boolean(m.mock_lightning)))
      .catch(() => {});
    const es = new EventSource("/api/stream");
    esRef.current = es;
    es.addEventListener("hello", () => setStreamLive(true));
    es.addEventListener("challenge_issued", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as ChallengeIssued;
      const item: FeedItem = { kind: "challenge", ts: Date.now(), data };
      setFeed((f) => [item, ...f].slice(0, 60));
    });
    es.addEventListener("receipt", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as Receipt;
      const item: FeedItem = { kind: "receipt", ts: Date.now(), data };
      setFeed((f) => [item, ...f].slice(0, 60));
      refetchStats();
    });
    es.onerror = () => setStreamLive(false);
    const tickerId = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      es.close();
      clearInterval(tickerId);
    };
  }, []);

  const totalCount = useMemo(
    () => (stats?.by_action ?? []).reduce((a, b) => a + b.count, 0),
    [stats],
  );
  const maxByAction = useMemo(
    () => Math.max(1, ...(stats?.by_action ?? []).map((a) => a.total_msats)),
    [stats],
  );
  const avgMsats =
    totalCount > 0 ? Math.round((stats?.total_revenue_msats ?? 0) / totalCount) : 0;
  const lastReceipt = stats?.receipts?.[0];

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b hairline bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-3 sm:px-10">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-3 text-[var(--text-2)] hover:text-zinc-950 transition"
            >
              <Mark />
              <span className="font-semibold tracking-tight text-zinc-950">Tollgate</span>
            </Link>
            <span className="text-[var(--text-4)]">/</span>
            <span className="label text-[var(--text-3)]">Live operations</span>
          </div>
          <div className="flex items-center gap-4">
            {mockMode && (
              <span className="border border-fuchsia-200 bg-fuchsia-50 px-2 py-0.5 label text-fuchsia-800">
                Mock Lightning
              </span>
            )}
            <span className="flex items-center gap-2 label text-[var(--text-3)]">
              <span
                className={`size-1.5 rounded-full transition ${
                  streamLive ? "bg-emerald-500 pulse-dot" : "bg-zinc-400"
                }`}
              />
              {streamLive ? "Stream live" : "Reconnecting"}
            </span>
            <Link
              href="/.well-known/tollgate.json"
              className="font-mono text-[12px] text-[var(--text-3)] hover:text-zinc-950 transition"
            >
              manifest ↗
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-6 sm:px-10">
        {/* page heading */}
        <div className="border-b hairline py-10">
          <div className="label text-[var(--text-3)]">Dashboard</div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
            <h1 className="display text-[clamp(28px,3.5vw,44px)] text-zinc-950">
              Operations
            </h1>
            <div className="font-mono text-[12px] text-[var(--text-3)]">
              {lastReceipt
                ? `last receipt · ${shortHash(lastReceipt.receipt_id, 8)} · ${since(lastReceipt.created_at)}`
                : "awaiting first paid action"}
            </div>
          </div>
        </div>

        {/* metric strip */}
        <div className="grid grid-cols-2 border-b hairline sm:grid-cols-4">
          <Metric label="Revenue" value={formatSats(stats?.total_revenue_msats ?? 0)} sub="all-time" />
          <Metric label="Paid actions" value={totalCount.toString()} sub="all-time" />
          <Metric label="Avg / call" value={formatSats(avgMsats)} sub="msats per action" />
          <Metric
            label="Distinct buyers"
            value={`${new Set((stats?.receipts ?? []).map((r) => r.payment_hash.slice(0, 16))).size}`}
            sub="unique payment hashes"
          />
        </div>

        {/* live + breakdown */}
        <div className="grid grid-cols-12 gap-px border-b hairline bg-[var(--line)]">
          <div className="col-span-12 bg-[var(--bg)] p-6 lg:col-span-5">
            <div className="flex items-baseline justify-between">
              <div className="label text-[var(--text-3)]">Live feed</div>
              <div className="font-mono text-[11px] text-[var(--text-4)]">
                {feed.length} events · {streamLive ? "live" : "—"}
              </div>
            </div>
            <ul className="mt-5 space-y-1">
              {feed.length === 0 && (
                <li className="border hairline px-4 py-8 text-center font-mono text-[12px] text-[var(--text-3)]">
                  awaiting first paid action — try{" "}
                  <span className="text-zinc-950">curl -X POST /api/actions/ask.site_agent</span>
                </li>
              )}
              {feed.map((item, i) => (
                <li
                  key={`${item.kind}-${item.ts}-${i}`}
                  className="flash-in flex items-center justify-between border-b hairline py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <FeedTag kind={item.kind} />
                    <span className="font-mono text-[13px] text-zinc-950">
                      {item.data.action_id}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--text-4)]">
                      {shortHash(item.data.payment_hash, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[12px] tabular text-[var(--text-2)]">
                      {formatSats(item.data.amount_msats)}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--text-4)] w-14 text-right">
                      {since(item.ts)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-12 bg-[var(--bg)] p-6 lg:col-span-7">
            <div className="flex items-baseline justify-between">
              <div className="label text-[var(--text-3)]">Revenue by action</div>
              <div className="font-mono text-[11px] text-[var(--text-4)]">
                {(stats?.by_action ?? []).length} actions
              </div>
            </div>
            {!stats || stats.by_action.length === 0 ? (
              <div className="mt-5 border hairline px-4 py-12 text-center font-mono text-[12px] text-[var(--text-3)]">
                no data yet
              </div>
            ) : (
              <ul className="mt-5 space-y-3">
                {stats.by_action.map((a) => (
                  <li key={a.action_id} className="border-b hairline pb-3 last:border-b-0">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[13px] text-zinc-950">
                        {a.action_id}
                      </span>
                      <span className="font-mono text-[12px] tabular text-[var(--text-2)]">
                        <span className="text-[var(--text-4)]">{a.count} call{a.count === 1 ? "" : "s"} · </span>
                        <span className="text-zinc-950">{formatSats(a.total_msats)}</span>
                      </span>
                    </div>
                    <div className="mt-2 h-[2px] bg-[var(--line)] overflow-hidden">
                      <div
                        className="h-full bg-zinc-950 transition-all"
                        style={{ width: `${(a.total_msats / maxByAction) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* receipts */}
        <div className="border-b hairline py-10">
          <div className="flex items-baseline justify-between pb-5">
            <div>
              <div className="label text-[var(--text-3)]">Receipts</div>
              <div className="mt-1 font-mono text-[12px] text-[var(--text-4)]">
                {stats?.receipts.length ?? 0} signed entries · click to inspect
              </div>
            </div>
          </div>
          <div className="border hairline">
            <div className="grid grid-cols-12 border-b hairline bg-[var(--surface)] px-5 py-3">
              <div className="col-span-3 label text-[var(--text-3)]">Receipt</div>
              <div className="col-span-3 label text-[var(--text-3)]">Action</div>
              <div className="col-span-2 label text-[var(--text-3)]">Amount</div>
              <div className="col-span-2 label text-[var(--text-3)]">Payment hash</div>
              <div className="col-span-2 label text-[var(--text-3)] text-right">When</div>
            </div>
            {(stats?.receipts ?? []).length === 0 && (
              <div className="px-5 py-12 text-center font-mono text-[12px] text-[var(--text-3)]">
                no receipts yet
              </div>
            )}
            {(stats?.receipts ?? []).map((r, i) => (
              <ReceiptRow
                key={r.receipt_id}
                receipt={r}
                expanded={expanded === r.receipt_id}
                onToggle={() => setExpanded((cur) => (cur === r.receipt_id ? null : r.receipt_id))}
                last={i === (stats?.receipts ?? []).length - 1}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between py-6 text-[12px]">
          <div className="font-mono text-[var(--text-4)]">tollgate / 2026</div>
          <div className="label text-[var(--text-4)]">Live operations · v0.1</div>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------------ */

function Mark() {
  return (
    <span className="grid size-6 place-items-center border hairline-2 bg-zinc-950 text-white">
      <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
        <path d="M3 2h1v12H3zM12 2h1v12h-1zM6 5h4v6H6z" />
      </svg>
    </span>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-r hairline last:border-r-0 px-6 py-6">
      <div className="label text-[var(--text-3)]">{label}</div>
      <div className="mt-3 font-mono text-2xl tabular text-zinc-950">{value}</div>
      {sub && <div className="mt-1 font-mono text-[11px] text-[var(--text-4)]">{sub}</div>}
    </div>
  );
}

function FeedTag({ kind }: { kind: "challenge" | "receipt" }) {
  if (kind === "receipt") {
    return (
      <span className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-800">
        ok
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 border hairline bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-2)]">
      402
    </span>
  );
}

function ReceiptRow({
  receipt,
  expanded,
  onToggle,
  last,
}: {
  receipt: Receipt;
  expanded: boolean;
  onToggle: () => void;
  last: boolean;
}) {
  return (
    <>
      <div
        className={`grid grid-cols-12 cursor-pointer items-center px-5 py-3 transition hover:bg-[var(--surface)] ${
          last ? "" : "border-b hairline"
        }`}
        onClick={onToggle}
      >
        <div className="col-span-3 font-mono text-[13px] text-zinc-950">
          {receipt.receipt_id}
        </div>
        <div className="col-span-3 font-mono text-[13px] text-[var(--text-2)]">
          {receipt.action_id}
        </div>
        <div className="col-span-2 font-mono text-[13px] tabular text-zinc-950">
          {formatSats(receipt.amount_msats)}
        </div>
        <div className="col-span-2 font-mono text-[12px] text-[var(--text-3)]">
          {shortHash(receipt.payment_hash, 6)}
        </div>
        <div className="col-span-2 font-mono text-[12px] text-[var(--text-3)] text-right">
          {since(receipt.created_at)}
        </div>
      </div>
      {expanded && (
        <div className="border-t hairline bg-[var(--bg-2)] px-5 py-4">
          <div className="label text-[var(--text-3)] mb-2">Signed receipt payload</div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-[var(--text-2)]">
            {JSON.stringify(receipt, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}

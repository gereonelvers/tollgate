"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearWallet, loadWallet, type StoredWallet } from "@/lib/storage";

export function DeveloperPanel() {
  const [wallet, setWallet] = useState<StoredWallet | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setWallet(loadWallet());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">Developer settings</div>
          <div className="label text-[var(--text-4)]">advanced · use with care</div>
        </div>
        <div className="grid grid-cols-12 gap-x-8 py-12">
          <div className="col-span-12 lg:col-span-5">
            <h1 className="display text-[clamp(28px,4vw,44px)] text-zinc-950">
              Power tools.
            </h1>
            <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-[var(--text-2)]">
              Inspect what&apos;s in localStorage, switch backends, reset state.
              Nothing here calls our backend; everything operates on your local
              wallet config.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-7">
            <div className="border hairline bg-white">
              <Row label="Provider" value={wallet?.provider ?? "—"} />
              <Row label="Created" value={wallet?.created_at ?? "—"} />
              <Row label="Label" value={wallet?.label ?? "—"} />
              <Row label="Lightning address" value={wallet?.lightning_address ?? "—"} />
              <Row label="Sponsor claimed" value={wallet?.sponsor_claimed ? "yes" : "no"} />
              <Row label="Self-custody accepted" value={wallet?.accepted_self_custody ? "yes" : "no"} />
            </div>

            <div className="mt-8 border hairline bg-white p-6">
              <div className="label text-[var(--text-3)]">Switch provider</div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Link
                  href="/setup/byo"
                  className="border hairline bg-[var(--bg)] px-4 py-3 text-[13px] text-zinc-950 hover:bg-[var(--surface)] transition text-center"
                >
                  Connect NWC →
                </Link>
                <Link
                  href="/setup/demo"
                  className="border hairline bg-[var(--bg)] px-4 py-3 text-[13px] text-zinc-950 hover:bg-[var(--surface)] transition text-center"
                >
                  Use demo (fake) →
                </Link>
                <button
                  type="button"
                  className="border hairline bg-[var(--bg)] px-4 py-3 text-[13px] text-[var(--text-3)] cursor-not-allowed"
                  disabled
                >
                  Spark (soon)
                </button>
              </div>
            </div>

            <div className="mt-8 border hairline bg-rose-50 p-6">
              <div className="label text-rose-800">Danger zone</div>
              <p className="mt-3 text-[14px] leading-relaxed text-rose-900">
                Forget the wallet config in this browser. The actual wallet
                at your provider is unaffected — you can re-import the same
                NWC URI later.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Forget all wallet config?")) {
                    clearWallet();
                    setWallet(null);
                  }
                }}
                className="mt-4 border border-rose-300 bg-white px-4 py-2 text-[13px] font-medium text-rose-800 hover:bg-rose-100 transition"
              >
                Clear local wallet config
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-12 border-b hairline last:border-b-0 px-5 py-3">
      <div className="col-span-4 label text-[var(--text-3)]">{label}</div>
      <div className="col-span-8 font-mono text-[13px] text-zinc-950 truncate">{value}</div>
    </div>
  );
}

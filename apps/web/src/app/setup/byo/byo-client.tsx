"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isValidNwcUrl,
  newNwcWallet,
  saveWallet,
  extractLnAddressFromNwc,
} from "@/lib/storage";

const WALLET_OPTIONS = [
  {
    name: "Primal",
    url: "https://primal.net",
    note: "Built into Primal app — fast, mobile, in-app fiat onramp where available.",
    fastest: true,
  },
  {
    name: "Coinos",
    url: "https://coinos.io",
    note: "Free custodial. Username + password only. Add NWC connection in Settings → Connections.",
    fastest: true,
  },
  {
    name: "Alby Hub",
    url: "https://albyhub.com",
    note: "Self-custodial. Some setup required (channels), most full-featured.",
  },
  {
    name: "Mutiny / Phoenix / LNbits",
    url: "#",
    note: "Any wallet that exposes an NWC connection URI works.",
  },
];

export function ByoSetup() {
  const [nwcUrl, setNwcUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const lnAddress = nwcUrl ? extractLnAddressFromNwc(nwcUrl.trim()) : undefined;

  function handleConnect() {
    setError(null);
    const trimmed = nwcUrl.trim();
    if (!isValidNwcUrl(trimmed)) {
      setError(
        "That doesn't look like a valid NWC URI. It should start with nostr+walletconnect:// followed by a 64-character hex pubkey.",
      );
      return;
    }
    const wallet = newNwcWallet(trimmed, label.trim() || undefined);
    saveWallet(wallet);
    router.push("/wallet");
  }

  return (
    <>
      <section className="border-b hairline">
        <div className="mx-auto max-w-[1100px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">Connect existing wallet</div>
            <div className="label text-[var(--text-4)]">setup / 01 — bring your own</div>
          </div>
          <div className="grid grid-cols-12 gap-x-8 py-16">
            <div className="col-span-12 lg:col-span-5">
              <h1 className="display text-[clamp(32px,5vw,52px)] text-zinc-950">
                Paste an NWC
                <br />
                connection URI.
              </h1>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--text-2)]">
                Nostr Wallet Connect is an open standard for granting limited
                spending authority to applications. Most modern Lightning wallets
                support it. The URI we ask for stays in your browser&apos;s local
                storage; we never receive it.
              </p>
            </div>

            <div className="col-span-12 lg:col-span-7">
              <div className="border hairline bg-white p-7">
                <div className="label text-[var(--text-3)] mb-2">NWC connection URI</div>
                <textarea
                  value={nwcUrl}
                  onChange={(e) => setNwcUrl(e.target.value)}
                  rows={4}
                  spellCheck={false}
                  placeholder="nostr+walletconnect://abc123…?relay=wss://relay.example.com&secret=…"
                  className="w-full resize-y border hairline bg-[var(--bg-2)] px-3 py-2.5 font-mono text-[12.5px] text-zinc-950 placeholder:text-[var(--text-4)] focus:border-zinc-700 focus:outline-none"
                />
                {lnAddress && (
                  <div className="mt-2 font-mono text-[12px] text-[var(--text-3)]">
                    Detected Lightning address: <span className="text-zinc-950">{lnAddress}</span>
                  </div>
                )}

                <div className="mt-6 label text-[var(--text-3)] mb-2">Label (optional)</div>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="My Primal wallet"
                  className="w-full border hairline bg-[var(--bg-2)] px-3 py-2.5 text-[14px] text-zinc-950 placeholder:text-[var(--text-4)] focus:border-zinc-700 focus:outline-none"
                />

                {error && (
                  <div className="mt-4 border border-rose-200 bg-rose-50 px-4 py-3 text-[13.5px] text-rose-800">
                    {error}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between border-t hairline pt-5">
                  <Link
                    href="/"
                    className="text-[13px] text-[var(--text-3)] hover:text-zinc-950 transition"
                  >
                    ← back to setup
                  </Link>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={!nwcUrl.trim()}
                    className="border hairline bg-zinc-950 px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-950"
                  >
                    Connect →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b hairline">
        <div className="mx-auto max-w-[1100px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">Where do I get one?</div>
            <div className="label text-[var(--text-4)]">setup / 02</div>
          </div>
          <div className="grid grid-cols-1 gap-px border-y hairline bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
            {WALLET_OPTIONS.map((w) => (
              <a
                key={w.name}
                href={w.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-[var(--bg)] p-6 transition hover:bg-[var(--surface)]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-medium text-zinc-950">{w.name}</div>
                  {w.fastest && (
                    <span className="border border-emerald-200 bg-emerald-50 px-2 py-0.5 label text-emerald-800">
                      fast
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-2)]">{w.note}</p>
                <div className="mt-4 font-mono text-[11px] text-[var(--text-3)]">
                  {w.url === "#" ? "varies" : w.url.replace(/^https?:\/\//, "")} ↗
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b hairline">
        <div className="mx-auto max-w-[1100px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">How do I get the URI?</div>
            <div className="label text-[var(--text-4)]">setup / 03</div>
          </div>
          <ol className="grid grid-cols-12 gap-px border-b hairline bg-[var(--line)]">
            {[
              { n: "i.", t: "Open your wallet's Connections settings." },
              { n: "ii.", t: "Create a new connection (sometimes called 'NWC' or 'Nostr Wallet Connect')." },
              { n: "iii.", t: "Grant scopes: pay_invoice, make_invoice, lookup_invoice, get_balance." },
              { n: "iv.", t: "Set a budget — e.g., 10,000 sats / week is plenty for a demo." },
              { n: "v.", t: "Copy the URI starting with nostr+walletconnect:// and paste above." },
            ].map((s, i) => (
              <li key={i} className="col-span-12 bg-[var(--bg)] px-6 py-4">
                <span className="font-mono text-[12px] text-[var(--text-4)] mr-3">{s.n}</span>
                <span className="text-[14.5px] text-zinc-950">{s.t}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { newDevFakeWallet, saveWallet } from "@/lib/storage";

export function DemoSetup() {
  const router = useRouter();

  function handleStart() {
    const wallet = newDevFakeWallet("Demo wallet (no real sats)");
    saveWallet(wallet);
    router.push("/wallet");
  }

  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">Demo mode</div>
          <div className="label text-[var(--text-4)]">setup / 03 — no real sats</div>
        </div>
        <div className="grid grid-cols-12 gap-x-8 py-20 sm:py-28">
          <div className="col-span-12 lg:col-span-7">
            <h1 className="display text-[clamp(32px,5vw,56px)] text-zinc-950">
              Try the whole flow
              <br />
              <span className="text-[var(--text-3)]">without any real money.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--text-2)]">
              We&apos;ll spin up a fake wallet starting at 100 sats. Click
              through setup, see how spending policy works, generate an MCP
              config, and watch payments &ldquo;move&rdquo; in the dashboard.
              Nothing real happens; nothing real can break.
            </p>
            <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-[var(--text-3)]">
              When you&apos;re ready for a real wallet, just clear the demo
              from <Link href="/developer" className="border-b border-zinc-300 text-zinc-950 hover:border-zinc-950 transition">/developer</Link> and pick a real path.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-5 mt-10 lg:mt-0 flex flex-col justify-end">
            <div className="border hairline bg-[var(--surface)] p-6">
              <div className="label text-[var(--text-3)]">What you&apos;ll see</div>
              <ul className="mt-4 space-y-2.5 text-[14px] text-zinc-950">
                <li>• Wallet balance + receive flow</li>
                <li>• Spend-policy editor</li>
                <li>• Live receipts as you simulate calls</li>
                <li>• MCP config snippet ready to copy</li>
                <li>• Sponsor faucet (mocked — adds 50 fake sats)</li>
              </ul>
              <button
                type="button"
                onClick={handleStart}
                className="mt-6 w-full border hairline bg-zinc-950 px-5 py-3 text-[14px] font-medium text-white hover:bg-zinc-800 transition"
              >
                Start demo →
              </button>
              <Link
                href="/"
                className="mt-3 block text-center text-[13px] text-[var(--text-3)] hover:text-zinc-950 transition"
              >
                ← back
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

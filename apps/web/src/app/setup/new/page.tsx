import Link from "next/link";
import { Nav } from "@/components/Nav";

export const metadata = { title: "Create new wallet · Faregate" };

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav />
      <section className="border-b hairline">
        <div className="mx-auto max-w-[1000px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">Create new wallet</div>
            <div className="label text-[var(--text-4)]">setup / 02 — coming soon</div>
          </div>
          <div className="grid grid-cols-12 gap-x-8 py-24">
            <div className="col-span-12 lg:col-span-7">
              <h1 className="display text-[clamp(32px,5vw,56px)] text-zinc-950">
                In-browser wallet
                <br />
                <span className="text-[var(--text-3)]">isn&apos;t shipped yet.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--text-2)]">
                We&apos;re integrating the Spark SDK so the wallet can be
                generated in your browser, encrypted with a passphrase, and
                kept entirely client-side. Until then, the equivalent paths are
                already available:
              </p>
              <div className="mt-8 grid grid-cols-1 gap-px border hairline bg-[var(--line)] sm:grid-cols-2">
                <Link
                  href="/setup/byo"
                  className="block bg-[var(--bg)] p-6 transition hover:bg-[var(--surface)]"
                >
                  <div className="label text-[var(--text-3)]">Recommended</div>
                  <div className="mt-3 text-[16px] font-medium text-zinc-950">
                    Bring your own wallet →
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-2)]">
                    Use any NWC-compatible wallet you already have or create one
                    in 3 minutes (Primal, Coinos, Alby Hub).
                  </p>
                </Link>
                <Link
                  href="/setup/demo"
                  className="block bg-[var(--bg)] p-6 transition hover:bg-[var(--surface)]"
                >
                  <div className="label text-[var(--text-3)]">Just exploring</div>
                  <div className="mt-3 text-[16px] font-medium text-zinc-950">
                    Try the demo →
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-2)]">
                    Click through the whole flow with a fake wallet — no real
                    sats, instant.
                  </p>
                </Link>
              </div>
              <p className="mt-8 max-w-xl text-[13.5px] leading-relaxed text-[var(--text-3)]">
                Tracking the Spark integration in{" "}
                <Link
                  href="https://github.com/gereonelvers/tollgate/issues"
                  className="border-b border-zinc-300 text-zinc-950 hover:border-zinc-950 transition"
                >
                  the issue tracker
                </Link>
                . When it ships, this page will let you generate, back up, and
                fund a self-custodial wallet without ever creating an account.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

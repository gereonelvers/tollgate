import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav />

      <section className="border-b hairline">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">Setup</div>
            <div className="label text-[var(--text-4)]">3 min · self-custodial</div>
          </div>
          <div className="grid grid-cols-12 gap-x-8 py-20 sm:py-28">
            <div className="col-span-12 lg:col-span-9">
              <h1 className="display-tight text-[clamp(40px,7vw,96px)] text-zinc-950">
                A Lightning wallet
                <br />
                <span className="text-[var(--text-3)]">your agent can spend from.</span>
              </h1>
            </div>
            <div className="col-span-12 lg:col-span-3 mt-12 lg:mt-0 flex flex-col justify-end">
              <p className="text-[15px] leading-relaxed text-[var(--text-2)]">
                Faregate sets up a wallet your AI agent uses to pay for paid
                actions over Lightning, under a spending policy you control.
                We don&apos;t custody your funds, we don&apos;t track your
                balance, and Claude never sees your secret.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b hairline">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">Pick a path</div>
            <div className="label text-[var(--text-4)]">faregate / 01</div>
          </div>
          <div className="grid grid-cols-1 gap-px bg-[var(--line)] sm:grid-cols-3">
            <PathCard
              n="01"
              title="Bring your own wallet"
              recommended
              body="Already have a Lightning wallet that supports Nostr Wallet Connect (Alby, Coinos, Primal, Mutiny, ln.bot)? Paste the connection URI."
              cta="Connect existing wallet →"
              href="/setup/byo"
              meta="2 min · zero new accounts"
            />
            <PathCard
              n="02"
              title="Make me one"
              body="We generate a self-custodial wallet right here. You hold the seed; we hold nothing. Optional 50-sat starter from the sponsor faucet."
              cta="Create new wallet →"
              href="/setup/new"
              meta="3 min · seed phrase backup required"
            />
            <PathCard
              n="03"
              title="Just show me"
              body="In-memory fake wallet. No real sats. Lets you click through the whole flow — receipts, policy, MCP config — to see how it works."
              cta="Try the demo →"
              href="/setup/demo"
              meta="instant · zero risk"
            />
          </div>
        </div>
      </section>

      <section className="border-b hairline">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">What you get</div>
            <div className="label text-[var(--text-4)]">faregate / 02</div>
          </div>
          <div className="grid grid-cols-12 gap-8 py-20">
            <div className="col-span-12 lg:col-span-5">
              <h2 className="display text-[clamp(28px,4vw,48px)] text-zinc-950">
                A wallet, a policy,
                <br />
                <span className="text-[var(--text-3)]">and an MCP plug-in.</span>
              </h2>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--text-2)]">
                Three artifacts after setup. Your wallet stays in your browser.
                The policy lives in your config dir. The MCP plug-in is a single
                JSON snippet your agent client reads — Claude Desktop, Claude
                Code, anything that speaks Model Context Protocol.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <div className="grid grid-cols-1 border hairline">
                <Step
                  n="i"
                  title="Wallet"
                  body="Lightning-capable wallet you own. We use Nostr Wallet Connect under the hood — you can swap providers any time."
                />
                <Step
                  n="ii"
                  title="Policy"
                  mid
                  body="Daily budget, per-action max, allowed action types, network reputation thresholds. Refusals happen in code, not in the model."
                />
                <Step
                  n="iii"
                  title="MCP plug-in"
                  body="A small JSON snippet your agent client loads. Five tools: discover, pay_and_invoke, publish_feedback, get_reputation, spend_summary."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b hairline">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">What we never do</div>
            <div className="label text-[var(--text-4)]">faregate / 03</div>
          </div>
          <div className="grid grid-cols-12 gap-8 py-16">
            <div className="col-span-12 lg:col-span-5">
              <h2 className="display text-[clamp(28px,4vw,48px)] text-zinc-950">
                We are not
                <br />
                a custodian.
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <ul className="grid grid-cols-1 gap-px border hairline bg-[var(--line)] sm:grid-cols-2">
                <Promise text="We never see your wallet secret." />
                <Promise text="We never spend your funds." />
                <Promise text="We never freeze, claw back, or restrict." />
                <Promise text="Your sponsored sats are yours immediately." />
                <Promise text="Your spend policy lives on your machine." />
                <Promise text="Claude never receives a private key." />
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

/* -------------------------------------------------------------- */

function PathCard({
  n,
  title,
  body,
  cta,
  href,
  meta,
  recommended,
  soon,
}: {
  n: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  meta: string;
  recommended?: boolean;
  soon?: boolean;
}) {
  const inner = (
    <div
      className={`group relative flex h-full flex-col bg-[var(--bg)] p-7 transition ${
        soon ? "opacity-60" : "hover:bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-[var(--text-4)]">[ {n} ]</span>
        {recommended && (
          <span className="border border-emerald-200 bg-emerald-50 px-2 py-0.5 label text-emerald-800">
            recommended
          </span>
        )}
        {soon && (
          <span className="border border-amber-200 bg-amber-50 px-2 py-0.5 label text-amber-800">
            soon
          </span>
        )}
      </div>
      <div className="mt-4 text-[20px] font-semibold tracking-tight text-zinc-950">{title}</div>
      <p className="mt-3 flex-1 text-[14px] leading-relaxed text-[var(--text-2)]">{body}</p>
      <div className="mt-6 flex items-center justify-between border-t hairline pt-3">
        <span className="font-mono text-[11px] text-[var(--text-4)]">{meta}</span>
        <span className="text-[13px] font-medium text-zinc-950 group-hover:translate-x-0.5 transition">
          {cta}
        </span>
      </div>
    </div>
  );
  if (soon) {
    return <div>{inner}</div>;
  }
  return <Link href={href}>{inner}</Link>;
}

function Step({
  n,
  title,
  body,
  mid,
}: {
  n: string;
  title: string;
  body: string;
  mid?: boolean;
}) {
  return (
    <div className={`grid grid-cols-12 px-6 py-6 ${mid ? "border-y hairline" : ""}`}>
      <div className="col-span-2 sm:col-span-1">
        <span className="font-mono text-[11px] text-[var(--text-4)]">{n}.</span>
      </div>
      <div className="col-span-10 sm:col-span-11">
        <div className="text-[16px] font-medium text-zinc-950">{title}</div>
        <p className="mt-1 text-[14px] leading-relaxed text-[var(--text-2)]">{body}</p>
      </div>
    </div>
  );
}

function Promise({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 bg-[var(--bg)] px-5 py-4">
      <span className="text-emerald-600">✓</span>
      <span className="text-[14.5px] text-zinc-950">{text}</span>
    </li>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-4 px-6 py-10 sm:flex-row sm:items-center sm:px-10">
        <div className="flex items-center gap-3 text-[var(--text-3)] text-sm">
          <span>Faregate</span>
          <span className="text-[var(--text-4)]">·</span>
          <span>built for Hack-Nation 2026 × Spiral</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Link href="https://agents402.org" className="text-[var(--text-3)] hover:text-zinc-950 transition">
            agents402 spec ↗
          </Link>
          <Link href="https://github.com/gereonelvers/tollgate" className="text-[var(--text-3)] hover:text-zinc-950 transition">
            GitHub ↗
          </Link>
        </div>
      </div>
    </footer>
  );
}

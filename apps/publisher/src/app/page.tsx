import Link from "next/link";
import { listActions } from "@/lib/actions";
import { totalRevenueMsats, listRecentReceipts } from "@/lib/db";

export const dynamic = "force-dynamic";

const formatSats = (msats: number) => {
  const sats = msats / 1000;
  if (sats < 1) return `${msats.toLocaleString()} msat`;
  if (sats < 1000) return `${sats.toLocaleString(undefined, { maximumFractionDigits: 1 })} sat`;
  return `${(sats / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })}k sat`;
};

export default function Home() {
  const actions = listActions();
  const revenue = totalRevenueMsats();
  const calls = listRecentReceipts(1000).length;

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav />

      {/* HERO */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
          <div className="flex items-center justify-between border-b hairline py-3">
            <div className="label text-[var(--text-3)]">Introduction</div>
            <div className="label text-[var(--text-4)]">v0.1 · open protocol</div>
          </div>
          <div className="grid grid-cols-12 gap-x-8 py-24 sm:py-32">
            <div className="col-span-12 lg:col-span-9">
              <h1 className="display-tight text-[clamp(52px,9vw,128px)] text-zinc-950">
                Paid actions
                <br />
                for the
                <br />
                <span className="text-[var(--text-3)]">agent web.</span>
              </h1>
            </div>
            <div className="col-span-12 lg:col-span-3 mt-12 lg:mt-0 flex flex-col justify-end">
              <p className="text-[15px] leading-relaxed text-[var(--text-2)]">
                Tollgate is a manifest-driven paid-access protocol. Sites declare
                what an AI agent can buy. Agents pay over Lightning under policy
                enforced in code. Every paid action ships a signed receipt.
              </p>
              <div className="mt-8 flex flex-col gap-2.5">
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center justify-between border hairline bg-zinc-950 px-4 py-3 text-[13px] text-white transition hover:bg-zinc-800"
                >
                  <span>Live dashboard</span>
                  <span className="text-zinc-400 group-hover:translate-x-0.5 group-hover:text-white transition">
                    →
                  </span>
                </Link>
                <Link
                  href="/.well-known/faregate.json"
                  className="group inline-flex items-center justify-between border hairline bg-white px-4 py-3 text-[13px] transition hover:bg-[var(--surface)]"
                >
                  <span className="font-mono text-[var(--text-2)] group-hover:text-zinc-950">
                    /.well-known/faregate.json
                  </span>
                  <span className="text-[var(--text-3)] group-hover:text-zinc-950 transition">
                    ↗
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* metric strip */}
          <div className="grid grid-cols-2 border-t hairline sm:grid-cols-4">
            <Metric label="Protocol" value="L402" sub="Lightning" />
            <Metric label="Paid actions" value={calls.toString()} sub="all-time" />
            <Metric label="Revenue" value={formatSats(revenue)} sub="all-time" />
            <Metric label="Settlement" value="< 2s" sub="warm channel" />
          </div>
        </div>
      </section>

      <Chapter
        kicker="Catalog"
        title="What this publisher is selling."
        body="Each action is fixed-price, has a deterministic input schema, and produces an Ed25519-signed receipt on completion. Discovery is a single GET request — no SDK, no scraping, no checkout."
      >
        <div className="border hairline">
          <div className="grid grid-cols-12 border-b hairline bg-[var(--surface)] px-6 py-3">
            <div className="col-span-6 label text-[var(--text-3)]">Action</div>
            <div className="col-span-2 label text-[var(--text-3)]">Type</div>
            <div className="col-span-2 label text-[var(--text-3)]">Risk</div>
            <div className="col-span-2 label text-[var(--text-3)] text-right">Price</div>
          </div>
          {actions.map((a, i) => (
            <div
              key={a.id}
              className={`grid grid-cols-12 items-start gap-4 px-6 py-5 transition hover:bg-[var(--bg-2)] ${
                i < actions.length - 1 ? "border-b hairline" : ""
              }`}
            >
              <div className="col-span-6">
                <div className="font-mono text-[13.5px] text-zinc-950">{a.id}</div>
                <div className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
                  {a.description}
                </div>
              </div>
              <div className="col-span-2">
                <Tag>{a.type}</Tag>
              </div>
              <div className="col-span-2">
                <RiskTag risk={a.risk} />
              </div>
              <div className="col-span-2 text-right">
                <div className="font-mono text-base tabular text-zinc-950">
                  {formatSats(a.price_msats)}
                </div>
                <div className="mt-1 font-mono text-[11px] text-[var(--text-3)] tabular">
                  {a.price_msats.toLocaleString()} msat
                </div>
              </div>
            </div>
          ))}
        </div>
      </Chapter>

      <Chapter
        kicker="Protocol"
        title="L402 over Lightning, with manifest-driven discovery."
        body={
          <>
            Tollgate sits above the standard Lightning HTTP 402 flow. The 402
            challenge is paired with a deterministic token binding{" "}
            <Code>action_id</Code>, hashed input, expiry, and the Lightning
            payment hash. Verification is cryptographic on the server side — no
            Lightning node access in the request path.
          </>
        }
      >
        <div className="border hairline bg-[var(--code-bg)]">
          <div className="flex items-center justify-between border-b border-[var(--code-line)] px-6 py-3">
            <div className="label text-zinc-400">HTTP transcript</div>
            <div className="label text-zinc-600">single paid action</div>
          </div>
          <pre className="overflow-x-auto px-6 py-6 text-[13px] leading-[1.7] font-mono text-zinc-300">
{`# 1 — agent invokes
`}<span className="text-white">POST</span>{` /api/actions/ask.site_agent
Content-Type: application/json

{ `}<span className="text-white">"question"</span>: <span className="text-sky-300">"Why micropayments now?"</span>{` }

# 2 — server returns L402 challenge
`}<span className="text-white">←</span>{` 402 Payment Required
WWW-Authenticate: L402 macaroon=`}<span className="text-sky-300">"…"</span>{`, invoice=`}<span className="text-sky-300">"lnbc…"</span>{`

# 3 — agent's NWC wallet pays the invoice → preimage

# 4 — agent retries with proof
`}<span className="text-white">POST</span>{` /api/actions/ask.site_agent
Authorization: L402 `}<span className="text-sky-300">{"<token>:<preimage>"}</span>{`

`}<span className="text-white">←</span>{` 200 OK · output + signed receipt`}
          </pre>
        </div>
      </Chapter>

      <Chapter
        kicker="Trust model"
        title="The model never approves its own spend."
        body="Tollgate's runtime enforces deterministic policy: daily budget, per-action max, allowed action types, new-service caps, blocked domains. The model can request — only the runtime can release."
      >
        <div className="grid grid-cols-1 border hairline sm:grid-cols-3">
          <Pillar
            n="i"
            title="Discover"
            body={
              <>
                Agents fetch <Code>/.well-known/faregate.json</Code>. A JSON
                file is the API surface: actions, types, prices, risk tags,
                schemas, receipt key.
              </>
            }
          />
          <Pillar
            n="ii"
            title="Enforce"
            mid
            body={
              <>
                Each <Code>pay_and_invoke</Code> is gated by a JSON policy you
                control. Caps per call, daily ceiling, allowed action types —
                code, not prompt.
              </>
            }
          />
          <Pillar
            n="iii"
            title="Prove"
            body={
              <>
                Every paid action returns an Ed25519-signed receipt binding{" "}
                <Code>input_hash</Code>, <Code>output_hash</Code>, amount, and{" "}
                <Code>payment_hash</Code>. Receipts compose into reputation.
              </>
            }
          />
        </div>
      </Chapter>

      <Chapter
        kicker="Why Lightning"
        title="The rail you choose shapes the world agents live in."
        body={
          <>
            Card rails can&apos;t carry sub-cent payments. Stablecoins put a
            single issuer between every two parties. Lightning is open,
            instant, and small. Tollgate runs end-to-end on mainnet sats — no
            gateways, no per-transaction minimums, no &quot;please complete the
            CAPTCHA.&quot;
          </>
        }
      />

      <Footer />
    </main>
  );
}

/* ------------------------------------------------------------------------ */
/* primitives                                                               */
/* ------------------------------------------------------------------------ */

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b hairline bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Mark />
          <span className="font-semibold tracking-tight text-zinc-950">Tollgate</span>
        </Link>
        <nav className="flex items-center gap-7 text-sm">
          <Link className="text-[var(--text-2)] hover:text-zinc-950 transition" href="/dashboard">
            Dashboard
          </Link>
          <Link
            className="font-mono text-[12.5px] text-[var(--text-2)] hover:text-zinc-950 transition"
            href="/.well-known/faregate.json"
          >
            manifest
          </Link>
          <Link
            href="https://github.com"
            className="text-[var(--text-3)] hover:text-zinc-950 transition"
          >
            GitHub
          </Link>
        </nav>
      </div>
    </header>
  );
}

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

function Chapter({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">{kicker}</div>
          <div className="label text-[var(--text-4)]">tollgate.protocol</div>
        </div>
        <div className="grid grid-cols-12 gap-8 py-20 sm:py-24">
          <div className="col-span-12 lg:col-span-5">
            <h2 className="display text-[clamp(34px,5vw,56px)] text-zinc-950">{title}</h2>
            {body && (
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--text-2)]">
                {body}
              </p>
            )}
          </div>
          {children && <div className="col-span-12 lg:col-span-7">{children}</div>}
        </div>
      </div>
    </section>
  );
}

function Pillar({
  n,
  title,
  body,
  mid,
}: {
  n: string;
  title: string;
  body: React.ReactNode;
  mid?: boolean;
}) {
  return (
    <div className={`p-7 ${mid ? "sm:border-x hairline" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] text-[var(--text-4)]">{n}.</span>
        <span className="label text-zinc-950">{title}</span>
      </div>
      <p className="mt-5 text-[14.5px] leading-relaxed text-[var(--text-2)]">{body}</p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center border hairline bg-[var(--surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-2)]">
      {children}
    </span>
  );
}

function RiskTag({ risk = "low" }: { risk?: "low" | "medium" | "high" }) {
  const cls =
    risk === "low"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : risk === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-rose-200 bg-rose-50 text-rose-800";
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 font-mono text-[11px] ${cls}`}>
      {risk}
    </span>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="border hairline bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[12.5px] text-zinc-950">
      {children}
    </code>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <div className="grid grid-cols-12 gap-8 py-16">
          <div className="col-span-12 lg:col-span-5">
            <Mark />
            <div className="mt-6 display text-[clamp(36px,5vw,68px)] text-zinc-950">
              The agent
              <br />
              economy needs
              <br />
              <span className="text-[var(--text-3)]">a price tag.</span>
            </div>
          </div>
          <div className="col-span-6 lg:col-span-2">
            <div className="label text-[var(--text-3)]">Protocol</div>
            <ul className="mt-4 space-y-2 text-sm text-[var(--text-2)]">
              <li>
                <Link href="/.well-known/faregate.json" className="hover:text-zinc-950">
                  Manifest
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-zinc-950">
                  Live dashboard
                </Link>
              </li>
              <li>
                <span className="text-[var(--text-4)]">Spec — soon</span>
              </li>
            </ul>
          </div>
          <div className="col-span-6 lg:col-span-2">
            <div className="label text-[var(--text-3)]">Stack</div>
            <ul className="mt-4 space-y-2 text-sm text-[var(--text-2)]">
              <li>L402</li>
              <li>Nostr Wallet Connect</li>
              <li>Model Context Protocol</li>
              <li>Lightning Network</li>
            </ul>
          </div>
          <div className="col-span-12 lg:col-span-3">
            <div className="label text-[var(--text-3)]">Credits</div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">
              Built for Hack-Nation 2026 × Spiral. Open protocol, open code.
              Receipts are signed; reputation is portable.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t hairline py-4 text-[12px]">
          <div className="font-mono text-[var(--text-4)]">tollgate / 2026</div>
          <div className="label text-[var(--text-4)]">Paid-action protocol · v0.1</div>
        </div>
      </div>
    </footer>
  );
}

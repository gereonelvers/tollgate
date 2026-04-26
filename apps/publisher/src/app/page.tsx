import Link from "next/link";
import { listActions } from "@/lib/actions";
import { totalRevenueMsats, listRecentReceipts } from "@/lib/db";
import { CORPUS } from "@/lib/corpus";

export const dynamic = "force-dynamic";

const VOL = "XVII";
const ISSUE = "IV";
const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

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
  const articles = CORPUS;
  const lead = articles[0]!;
  const sidebar = articles.slice(1);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* ───────── Masthead ───────── */}
      <header className="border-b-[3px] hairline">
        <div className="mx-auto max-w-[1280px] px-6 sm:px-10">
          {/* top strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b hairline-soft py-2 text-[11px]">
            <span className="font-mono text-[var(--text-3)]">
              Vol. {VOL} · Issue {ISSUE} · {TODAY}
            </span>
            <span className="label text-[var(--accent)]">
              Three (3) sats per question · Lightning accepted, feedback not
            </span>
            <span className="font-mono text-[var(--text-4)]">
              Today’s hash: 0x000…BEEF
            </span>
          </div>

          {/* big title */}
          <div className="py-7 text-center">
            <div className="masthead text-[clamp(56px,11vw,148px)] text-[var(--text)]">
              The Halving Gazette
            </div>
            <div className="mt-3 dek text-[clamp(13px,1.4vw,17px)]">
              All the news that&apos;s small enough to settle on a single block.
            </div>
          </div>

          {/* nav */}
          <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t hairline-soft py-3 text-[12.5px]">
            <NavLink href="/">Front Page</NavLink>
            <NavLink href="#archive">The Archive</NavLink>
            <NavLink href="/dashboard">Circulation Desk</NavLink>
            <NavLink href="/.well-known/agents402.json" mono>
              /.well-known/agents402.json
            </NavLink>
            <NavLink href="#colophon">Colophon</NavLink>
          </nav>
        </div>
      </header>

      {/* ───────── Above the fold ───────── */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-[1280px] px-6 sm:px-10 py-10">
          <div className="grid grid-cols-12 gap-x-10 gap-y-10">
            {/* lead story */}
            <article className="col-span-12 lg:col-span-8 lg:border-r lg:hairline-soft lg:pr-10">
              <div className="label">Lead</div>
              <h1 className="display-tight mt-3 text-[clamp(36px,5.5vw,68px)]">
                {lead.title}
              </h1>
              <div className="dek mt-3 text-[clamp(15px,1.5vw,18px)]">
                Filed by {lead.author}, our correspondent on the unconfirmed.
                Originally cited as <span className="font-mono">{lead.id}</span>{" "}
                in our archive — pay <span className="font-semibold">3 sats</span>{" "}
                to ask it anything, and we will pretend to be qualified.
              </div>

              <div className="mt-6 grid grid-cols-1 gap-x-8 sm:grid-cols-2 sm:[column-fill:balance]">
                {leadParagraphs(lead.body).map((p, i) => (
                  <p
                    key={i}
                    className={`mb-5 text-[15.5px] leading-[1.62] text-[var(--text)] ${
                      i === 0 ? "drop-cap" : ""
                    }`}
                  >
                    {p}
                  </p>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-4 border-t hairline-soft pt-4 text-[12.5px]">
                <span className="font-mono text-[var(--text-3)]">
                  Filed {lead.date}
                </span>
                <span className="text-[var(--text-4)]">·</span>
                <Link
                  href="/.well-known/agents402.json"
                  className="text-[var(--accent)] underline-offset-4 hover:underline"
                >
                  Subscribe (your agent does this)
                </Link>
              </div>
            </article>

            {/* sidebar */}
            <aside className="col-span-12 lg:col-span-4 space-y-8">
              <EditorialNote />
              <SidebarBox title="On The Wire" subtitle="recent paid actions">
                <Ticker calls={calls} revenue={revenue} />
              </SidebarBox>
              <Advertisement />
            </aside>
          </div>
        </div>
      </section>

      {/* ───────── Catalog (rebranded as 'Pricing & Subscriptions') ───────── */}
      <section id="archive" className="border-b hairline">
        <div className="mx-auto max-w-[1280px] px-6 sm:px-10 py-12">
          <div className="rule-double" />
          <div className="flex items-baseline justify-between py-3">
            <h2 className="display text-[clamp(28px,3.5vw,42px)]">
              Pricing &amp; Subscriptions
            </h2>
            <span className="label">For machines, mostly</span>
          </div>
          <p className="dek max-w-3xl text-[16px]">
            Every paid action below is fixed-price, returns an
            Ed25519&#8209;signed receipt, and is binding upon both parties. The
            second party is your agent. We are the first.
          </p>

          <div className="mt-7 border-y-[2px] hairline">
            <div className="grid grid-cols-12 gap-2 border-b hairline px-2 py-2">
              <ColHead className="col-span-6">Action</ColHead>
              <ColHead className="col-span-2">Type</ColHead>
              <ColHead className="col-span-2">Risk</ColHead>
              <ColHead className="col-span-2 text-right">Per call</ColHead>
            </div>
            {actions.map((a, i) => (
              <div
                key={a.id}
                className={`grid grid-cols-12 gap-2 px-2 py-5 ${
                  i < actions.length - 1 ? "border-b hairline-soft" : ""
                }`}
              >
                <div className="col-span-6">
                  <div className="font-mono text-[13.5px] text-[var(--text)]">
                    {a.id}
                  </div>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--text-2)]">
                    {a.description}
                  </p>
                </div>
                <div className="col-span-2 pt-1">
                  <Stamp>{a.type}</Stamp>
                </div>
                <div className="col-span-2 pt-1">
                  <RiskTag risk={a.risk} />
                </div>
                <div className="col-span-2 text-right pt-1">
                  <div className="font-mono text-[17px] tabular text-[var(--accent)]">
                    {formatSats(a.price_msats)}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[var(--text-4)] tabular">
                    {a.price_msats.toLocaleString()} msat
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="rule-double mt-7" />
        </div>
      </section>

      {/* ───────── More from the archive ───────── */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-[1280px] px-6 sm:px-10 py-12">
          <div className="flex items-baseline justify-between border-b hairline pb-3">
            <h2 className="display text-[clamp(26px,3.2vw,38px)]">
              From The Archive
            </h2>
            <span className="label">Yours, for 3 sats per question</span>
          </div>
          <div className="grid grid-cols-1 gap-x-10 gap-y-10 pt-9 sm:grid-cols-2 lg:grid-cols-3">
            {sidebar.map((doc) => (
              <article key={doc.id} className="border-l hairline-soft pl-5">
                <div className="label">{doc.date}</div>
                <h3 className="display mt-2 text-[22px] leading-[1.05]">
                  {doc.title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-2)]">
                  {firstSentences(doc.body, 2)}
                </p>
                <div className="mt-3 font-mono text-[11.5px] text-[var(--text-4)]">
                  {doc.id} · by {doc.author}
                </div>
              </article>
            ))}
            <FauxClassifiedColumn />
          </div>
        </div>
      </section>

      {/* ───────── How to subscribe (manifest box) ───────── */}
      <section className="border-b hairline">
        <div className="mx-auto max-w-[1280px] px-6 sm:px-10 py-14">
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-12 lg:col-span-5">
              <div className="label">How to Subscribe</div>
              <h2 className="display-tight mt-3 text-[clamp(28px,3.6vw,46px)]">
                We don&apos;t take your email. <br />
                <span className="text-[var(--text-3)] italic">
                  We take your sats.
                </span>
              </h2>
              <p className="dek mt-5 text-[16px]">
                Subscriptions are issued one paid action at a time. Your agent
                handles the boring parts. You handle the budget.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <div className="border hairline bg-[var(--code-bg)] text-[var(--code-text)]">
                <div className="flex items-center justify-between border-b border-[var(--code-line)] px-5 py-3">
                  <div className="label" style={{ color: "var(--code-comment)" }}>
                    HTTP transcript
                  </div>
                  <div className="font-mono text-[11px] text-[var(--code-comment)]">
                    one (1) confirmed micropayment
                  </div>
                </div>
                <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-[1.7]">
{`# 1 — agent puts a coin in the slot
`}<span className="text-[var(--code-keyword)]">POST</span>{` /api/actions/ask.site_agent
{ `}<span className="text-[var(--code-keyword)]">"question"</span>: <span className="text-[var(--code-string)]">"why does Lightning route in under a second?"</span>{` }

# 2 — the gazette presents the bill
`}<span className="text-[var(--code-keyword)]">←</span>{` 402 Payment Required
WWW-Authenticate: L402 macaroon=`}<span className="text-[var(--code-string)]">"…"</span>{`, invoice=`}<span className="text-[var(--code-string)]">"lnbc30n…"</span>{`

# 3 — agent pays. We hear the bell ring.

# 4 — agent comes back, receipt in hand
`}<span className="text-[var(--code-keyword)]">POST</span>{` /api/actions/ask.site_agent
Authorization: L402 `}<span className="text-[var(--code-string)]">{"<token>:<preimage>"}</span>{`

`}<span className="text-[var(--code-keyword)]">←</span>{` 200 OK · article + ed25519 receipt
                # ` }<span className="text-[var(--code-comment)]">{`(framed, on request)`}</span>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Colophon />
    </main>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* primitives                                                    */
/* ────────────────────────────────────────────────────────────── */

function NavLink({
  href,
  children,
  mono,
}: {
  href: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`text-[var(--text-2)] hover:text-[var(--accent)] transition ${
        mono ? "font-mono text-[12px]" : "font-medium"
      }`}
    >
      {children}
    </Link>
  );
}

function EditorialNote() {
  return (
    <div className="border-t-[2px] border-b hairline py-5">
      <div className="label text-[var(--accent)]">Editor&apos;s Note</div>
      <p className="mt-3 text-[14.5px] leading-relaxed">
        An earlier edition of this paper hallucinated three citations. They
        have since been confirmed in <span className="font-mono">six (6)</span>{" "}
        blocks. We thank our readership for their patience and our settlement
        layer for its efficiency.
      </p>
      <p className="mt-3 text-[13.5px] italic text-[var(--text-3)]">
        — The Editor, writing under a pseudonym for tax reasons.
      </p>
    </div>
  );
}

function SidebarBox({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border hairline">
      <div className="flex items-baseline justify-between border-b hairline bg-[var(--surface)] px-4 py-2">
        <span className="display text-[15px] font-semibold">{title}</span>
        {subtitle && <span className="label">{subtitle}</span>}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function Ticker({ calls, revenue }: { calls: number; revenue: number }) {
  return (
    <ul className="space-y-3 text-[13.5px]">
      <li className="flex items-baseline justify-between">
        <span className="text-[var(--text-2)]">Articles bought, all-time</span>
        <span className="font-mono text-[15px] tabular text-[var(--text)]">
          {calls.toLocaleString()}
        </span>
      </li>
      <li className="flex items-baseline justify-between">
        <span className="text-[var(--text-2)]">Sats received, all-time</span>
        <span className="font-mono text-[15px] tabular text-[var(--accent)]">
          {(revenue / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </span>
      </li>
      <li className="flex items-baseline justify-between">
        <span className="text-[var(--text-2)]">Settlement layer</span>
        <span className="font-mono text-[12px] text-[var(--text-3)]">Lightning</span>
      </li>
      <li className="flex items-baseline justify-between">
        <span className="text-[var(--text-2)]">Time-to-confirm</span>
        <span className="font-mono text-[12px] text-[var(--text-3)]">
          &lt; 2s (warm channel)
        </span>
      </li>
      <li className="pt-3 border-t hairline-soft text-[12px] italic text-[var(--text-3)]">
        Live counters — no editorial discretion. The numbers say what they say.
      </li>
    </ul>
  );
}

function Advertisement() {
  return (
    <div className="border-[2px] border-dashed hairline-soft p-5 text-center">
      <div className="label text-[var(--accent)]">— Advertisement —</div>
      <div className="display mt-3 text-[18px] leading-tight">
        Tired of <span className="italic">inbound liquidity</span>?
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-2)]">
        Try our new <span className="font-mono">channel.reserve</span>™ —
        accept payments in advance, settle them at your leisure, in a manner
        suspiciously reminiscent of how publishing already worked.
      </p>
      <div className="mt-3 font-mono text-[10.5px] text-[var(--text-4)]">
        Patent pending in seven (7) jurisdictions.
      </div>
    </div>
  );
}

function FauxClassifiedColumn() {
  return (
    <article className="border-l-[2px] hairline-soft pl-5">
      <div className="label">Classifieds</div>
      <h3 className="display mt-2 text-[20px] leading-[1.05]">
        Personals &amp; Notices
      </h3>
      <ul className="mt-4 space-y-3 text-[13.5px] leading-snug text-[var(--text-2)]">
        <li>
          <span className="font-semibold">WANTED.</span> Inbound liquidity. Will
          not exchange for channel reserve. Apologies to the gentleman from
          Wumbo Boulevard.
        </li>
        <li>
          <span className="font-semibold">FOR SALE.</span> One (1) Lightning
          node, slightly used, mempool clean. Reasonable offers in sats. No
          stablecoins, no tire-kickers, no testnet.
        </li>
        <li>
          <span className="font-semibold">CORRECTIONS.</span> A previous
          edition mistook the Lightning Network for the lightning network. The
          latter is just weather. The Editor regrets the confusion.
        </li>
        <li>
          <span className="font-semibold">NOTICE.</span> Articles fact-checked
          by a panel of stochastic parrots. Errors are not errors but features
          of the prior. Disagree? Pay 3 sats and ask.
        </li>
      </ul>
    </article>
  );
}

function ColHead({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`label text-[var(--text-3)] ${className}`}>{children}</div>
  );
}

function Stamp({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center border hairline bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-2)]">
      {children}
    </span>
  );
}

function RiskTag({ risk = "low" }: { risk?: "low" | "medium" | "high" }) {
  const map = {
    low: "border-[#3d5a2a] text-[#3d5a2a] bg-[#e6e8c8]",
    medium: "border-[#8a5a18] text-[#8a5a18] bg-[#f0dfb3]",
    high: "border-[#7a1d1d] text-[#7a1d1d] bg-[#f0d7d7]",
  } as const;
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[11px] ${map[risk]}`}
    >
      {risk}
    </span>
  );
}

function Colophon() {
  return (
    <footer id="colophon">
      <div className="mx-auto max-w-[1280px] px-6 sm:px-10 py-14">
        <div className="rule-double" />
        <div className="grid grid-cols-12 gap-8 py-10">
          <div className="col-span-12 lg:col-span-6">
            <div className="masthead text-[clamp(34px,5vw,56px)]">
              The Halving Gazette
            </div>
            <p className="dek mt-4 text-[15px] max-w-md">
              Established 2009 by an anonymous correspondent. Annual subscriptions
              paid in advance, in sats, no refunds. Frankly we&apos;re not sure
              who runs this and we have stopped asking.
            </p>
          </div>
          <div className="col-span-6 lg:col-span-3">
            <div className="label">Departments</div>
            <ul className="mt-4 space-y-2 text-[14px] text-[var(--text-2)]">
              <li>
                <Link href="/dashboard" className="hover:text-[var(--accent)]">
                  Circulation Desk
                </Link>
              </li>
              <li>
                <Link
                  href="/.well-known/agents402.json"
                  className="font-mono text-[12.5px] hover:text-[var(--accent)]"
                >
                  /.well-known/agents402.json
                </Link>
              </li>
              <li className="text-[var(--text-4)]">Crossword (NaN × NaN)</li>
              <li className="text-[var(--text-4)]">
                Letters to the Editor — under review since 2009
              </li>
            </ul>
          </div>
          <div className="col-span-6 lg:col-span-3">
            <div className="label">Imprint</div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--text-2)]">
              Set in <span className="italic">Playfair Display</span> &amp;{" "}
              <span className="italic">Newsreader</span>. Printed daily by twelve
              (12) Ed25519 signatures. Powered by{" "}
              <Link
                href="https://faregate.org"
                className="underline-offset-4 hover:text-[var(--accent)] hover:underline"
              >
                Faregate
              </Link>
              , who do not endorse our editorial line and could not stop us if
              they tried.
            </p>
          </div>
        </div>
        <div className="rule-thin" />
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 text-[12px]">
          <span className="font-mono text-[var(--text-4)]">
            Issue 0 was an empty block. We&apos;ve improved since.
          </span>
          <span className="label">
            Bear and bull markets covered with equal disinterest.
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* helpers                                                       */
/* ────────────────────────────────────────────────────────────── */

function leadParagraphs(body: string): string[] {
  return body
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstSentences(body: string, n: number): string {
  const sentences = body
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  return sentences.slice(0, n).join(" ");
}

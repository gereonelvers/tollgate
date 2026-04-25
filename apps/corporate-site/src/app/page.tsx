import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav />
      <Hero />
      <Logos />
      <Pitch />
      <HowWeHelp />
      <HowItWorks />
      <Pricing />
      <CaseStudy />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}

/* ------------------------------------------------------------------------ */

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b hairline bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Mark />
          <span className="font-semibold tracking-tight text-zinc-950">Tollgate</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm sm:flex">
          <a href="#how-we-help" className="text-[var(--text-2)] hover:text-zinc-950 transition">
            How we help
          </a>
          <a href="#how-it-works" className="text-[var(--text-2)] hover:text-zinc-950 transition">
            How it works
          </a>
          <a href="#pricing" className="text-[var(--text-2)] hover:text-zinc-950 transition">
            Pricing
          </a>
          <Link
            href="https://faregate.org"
            className="font-mono text-[12.5px] text-[var(--text-2)] hover:text-zinc-950 transition"
          >
            faregate.org ↗
          </Link>
        </nav>
        <Link
          href="#contact"
          className="border hairline bg-zinc-950 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800 transition"
        >
          Talk to us
        </Link>
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

function Hero() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">Tollgate · Implementation partner</div>
          <div className="label text-[var(--text-4)]">Open protocol · faregate</div>
        </div>
        <div className="grid grid-cols-12 gap-x-8 py-24 sm:py-32">
          <div className="col-span-12 lg:col-span-9">
            <h1 className="display-tight text-[clamp(48px,8vw,116px)] text-zinc-950">
              Earn from
              <br />
              AI agents
              <br />
              <span className="text-[var(--text-3)]">browsing your site.</span>
            </h1>
          </div>
          <div className="col-span-12 lg:col-span-3 mt-12 lg:mt-0 flex flex-col justify-end">
            <p className="text-[15px] leading-relaxed text-[var(--text-2)]">
              Tollgate is the implementation partner for the faregate paid-action
              standard. We instrument your APIs, content, and tools so AI agents
              pay you instantly over Lightning. You keep the revenue — we take a
              percentage on what we help you earn.
            </p>
            <div className="mt-8 flex flex-col gap-2.5">
              <Link
                href="#contact"
                className="group inline-flex items-center justify-between border hairline bg-zinc-950 px-4 py-3 text-[13px] text-white transition hover:bg-zinc-800"
              >
                <span>Talk to an engineer</span>
                <span className="text-zinc-400 group-hover:translate-x-0.5 group-hover:text-white transition">
                  →
                </span>
              </Link>
              <Link
                href="#how-it-works"
                className="group inline-flex items-center justify-between border hairline bg-white px-4 py-3 text-[13px] transition hover:bg-[var(--surface)]"
              >
                <span className="text-[var(--text-2)] group-hover:text-zinc-950">
                  How it works
                </span>
                <span className="text-[var(--text-3)] group-hover:text-zinc-950 transition">
                  ↓
                </span>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t hairline sm:grid-cols-4">
          <Metric label="Settlement" value="< 2s" sub="Lightning Network" />
          <Metric label="Min payment" value="1 sat" sub="≈ $0.0006" />
          <Metric label="Setup time" value="2 weeks" sub="typical pilot" />
          <Metric label="Standard" value="faregate" sub="open · permissionless" />
        </div>
      </div>
    </section>
  );
}

function Logos() {
  const items = [
    "ARCHIVE.NEWS",
    "MARKET·SIGNALS",
    "STATSCRAPE",
    "OPENPRESS",
    "VERTEX/DOCS",
    "FIELD·NOTES",
  ];
  return (
    <section className="border-b hairline bg-[var(--bg-2)]">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">Pilot partners</div>
          <div className="label text-[var(--text-4)]">indicative</div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-[var(--line)] sm:grid-cols-3 lg:grid-cols-6">
          {items.map((l) => (
            <div
              key={l}
              className="bg-[var(--bg-2)] px-6 py-8 text-center font-mono text-[12.5px] text-[var(--text-3)] tracking-[0.18em]"
            >
              {l}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pitch() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">The opportunity</div>
          <div className="label text-[var(--text-4)]">tollgate / 01</div>
        </div>
        <div className="grid grid-cols-12 gap-8 py-20 sm:py-24">
          <div className="col-span-12 lg:col-span-7">
            <h2 className="display text-[clamp(32px,5vw,56px)] text-zinc-950">
              Agent traffic is your fastest-growing
              <br />
              <span className="text-[var(--text-3)]">unmonetized channel.</span>
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-5 lg:pt-3">
            <p className="text-[16px] leading-relaxed text-[var(--text-2)]">
              By 2026 most of the requests hitting your site aren&apos;t humans —
              they&apos;re LLM agents reading, summarizing, fact-checking,
              generating reports. Three options have existed: block them, get
              scraped for free, or sign exclusive licensing with one of three big
              labs. Tollgate gives you the fourth: charge per call, in real time,
              over open infrastructure you don&apos;t have to host.
            </p>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--text-2)]">
              We instrument your existing API surface and content with the
              faregate standard, plug in Lightning settlement, and stand up the
              dashboard. Most pilots ship in two weeks.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowWeHelp() {
  const items = [
    {
      n: "01",
      title: "Audit & price",
      body: "We map every endpoint, page, and API on your site, segment by what's freely browsable vs. what an agent should pay for, and propose per-action prices grounded in current agent willingness-to-pay benchmarks.",
    },
    {
      n: "02",
      title: "Implementation",
      body: "We instrument your stack — middleware, manifest, signed receipts, dashboard. Cloudflare Worker, Next.js middleware, FastAPI, or your runtime of choice. Existing human traffic is untouched.",
    },
    {
      n: "03",
      title: "Wallet & treasury",
      body: "Custodial or self-custodial Lightning. We handle node operations, liquidity, fiat off-ramp, and accounting hooks into your finance stack. Daily, weekly, or per-payment settle to your bank.",
    },
    {
      n: "04",
      title: "Operate",
      body: "Ongoing monitoring, fraud heuristics, abuse rate-limiting, conformance updates as the protocol evolves. Quarterly business review with revenue attribution by agent class.",
    },
  ];
  return (
    <section id="how-we-help" className="border-b hairline">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">How we help</div>
          <div className="label text-[var(--text-4)]">tollgate / 02</div>
        </div>
        <div className="grid grid-cols-12 gap-8 py-20 sm:py-24">
          <div className="col-span-12 lg:col-span-5">
            <h2 className="display text-[clamp(32px,5vw,56px)] text-zinc-950">
              Four-step engagement.
              <br />
              <span className="text-[var(--text-3)]">Senior-staffed.</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--text-2)]">
              We don&apos;t deliver decks. We send a small team that ships
              code into your repo, your CI, and your wallet provider — then stays
              on through the first revenue cycle.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-7">
            <div className="grid grid-cols-1 border hairline sm:grid-cols-2">
              {items.map((it, i) => (
                <div
                  key={it.n}
                  className={`p-7 ${i % 2 === 0 ? "sm:border-r hairline" : ""} ${
                    i < 2 ? "sm:border-b hairline" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-[var(--text-4)]">
                      {it.n}
                    </span>
                    <span className="label text-zinc-950">{it.title}</span>
                  </div>
                  <p className="mt-4 text-[14.5px] leading-relaxed text-[var(--text-2)]">
                    {it.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b hairline">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">How it works</div>
          <div className="label text-[var(--text-4)]">tollgate / 03</div>
        </div>
        <div className="grid grid-cols-12 gap-8 py-20 sm:py-24">
          <div className="col-span-12 lg:col-span-5">
            <h2 className="display text-[clamp(32px,5vw,56px)] text-zinc-950">
              Open protocol.
              <br />
              <span className="text-[var(--text-3)]">No vendor lock-in.</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--text-2)]">
              We build on{" "}
              <a
                href="https://faregate.org"
                className="border-b border-zinc-300 text-zinc-950 hover:border-zinc-950 transition"
              >
                faregate
              </a>
              , an open paid-action standard. Your manifest lives at{" "}
              <Code>/.well-known/faregate.json</Code>; agents discover with a single
              GET; payment goes through L402 over Lightning. You can swap
              implementation partners (or take it in-house) at any time.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-7">
            <div className="border hairline bg-[var(--code-bg)]">
              <div className="flex items-center justify-between border-b border-[var(--code-line)] px-6 py-3">
                <div className="label text-zinc-400">Manifest</div>
                <div className="label text-zinc-600">/.well-known/faregate.json</div>
              </div>
              <pre className="overflow-x-auto px-6 py-6 text-[13px] leading-[1.7] font-mono text-zinc-300">
{`{
  "version": "0.1",
  "service": {
    "name": "Vertex Docs",
    "homepage": "https://vertex.example"
  },
  "actions": [
    {
      "id":           "ask.site_agent",
      "price_msats":  3000,
      "risk":         "low"
    },
    {
      "id":           "extract.structured",
      "price_msats":  1000,
      "risk":         "low"
    }
  ],
  "receipts": {
    "pubkey_hex": "…",
    "algorithm":  "ed25519"
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="border-b hairline">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">Pricing</div>
          <div className="label text-[var(--text-4)]">tollgate / 04</div>
        </div>
        <div className="grid grid-cols-12 gap-8 py-20 sm:py-24">
          <div className="col-span-12 lg:col-span-5">
            <h2 className="display text-[clamp(32px,5vw,56px)] text-zinc-950">
              Pay only when
              <br />
              <span className="text-[var(--text-3)]">we earn for you.</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--text-2)]">
              No setup fee, no minimum, no hosting markup. We take a percentage
              of revenue we help you generate. The protocol underneath is open
              and free forever.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-7">
            <div className="grid grid-cols-1 gap-px border hairline bg-[var(--line)] sm:grid-cols-3">
              <Tier
                tier="Pilot"
                rev="15%"
                period="of agent revenue · first 6 months"
                features={[
                  "Up to 5 paid actions",
                  "Hosted dashboard",
                  "Custodial Lightning wallet",
                  "Email support",
                  "Single-domain rollout",
                ]}
              />
              <Tier
                tier="Standard"
                rev="10%"
                period="of agent revenue · ongoing"
                highlight
                features={[
                  "Unlimited paid actions",
                  "Hosted dashboard + analytics API",
                  "Self-custodial wallet w/ liquidity ops",
                  "Slack-channel support",
                  "Multi-domain & subdomain support",
                  "Quarterly business review",
                ]}
              />
              <Tier
                tier="Enterprise"
                rev="Custom"
                period="multi-year, fixed-fee available"
                features={[
                  "On-prem or VPC deployment",
                  "Dedicated implementation team",
                  "Custom action types & SLAs",
                  "Treasury & accounting hooks",
                  "Compliance & audit support",
                  "Co-marketed standard adoption",
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Tier({
  tier,
  rev,
  period,
  features,
  highlight,
}: {
  tier: string;
  rev: string;
  period: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div className={`p-7 ${highlight ? "bg-zinc-950 text-white" : "bg-[var(--bg)]"}`}>
      <div className={`label ${highlight ? "text-zinc-400" : "text-[var(--text-3)]"}`}>
        {tier}
      </div>
      <div className={`mt-4 display tabular text-5xl ${highlight ? "text-white" : "text-zinc-950"}`}>
        {rev}
      </div>
      <div className={`mt-1 font-mono text-[12px] ${highlight ? "text-zinc-500" : "text-[var(--text-4)]"}`}>
        {period}
      </div>
      <ul className={`mt-6 space-y-2.5 text-[14px] leading-relaxed ${highlight ? "text-zinc-300" : "text-[var(--text-2)]"}`}>
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className={highlight ? "text-zinc-600" : "text-[var(--text-4)]"}>—</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CaseStudy() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">Case study</div>
          <div className="label text-[var(--text-4)]">tollgate / 05</div>
        </div>
        <div className="grid grid-cols-12 gap-8 py-20 sm:py-24">
          <div className="col-span-12 lg:col-span-7">
            <blockquote className="display text-[clamp(28px,3.6vw,44px)] text-zinc-950">
              &ldquo;Three weeks from kickoff to first paid action. Tollgate&apos;s
              team wrote the manifest, instrumented our Cloudflare Worker, and
              wired up the dashboard before our legal review on stablecoin
              alternatives even finished.&rdquo;
            </blockquote>
            <div className="mt-8 flex items-center gap-4">
              <div className="size-10 rounded-full bg-[var(--surface)]" />
              <div>
                <div className="text-[14px] font-medium text-zinc-950">L. Marsden</div>
                <div className="text-[13px] text-[var(--text-3)]">
                  CTO, Vertex Docs · API & developer reference
                </div>
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5">
            <div className="grid grid-cols-2 gap-px border hairline bg-[var(--line)]">
              <CaseStat n="3 weeks" label="Time to first payment" />
              <CaseStat n="42M" label="Agent requests / month" />
              <CaseStat n="$8.4k" label="Monthly recurring revenue" sub="from agent traffic" />
              <CaseStat n="0%" label="Impact on human users" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CaseStat({ n, label, sub }: { n: string; label: string; sub?: string }) {
  return (
    <div className="bg-[var(--bg)] p-6">
      <div className="display tabular text-3xl text-zinc-950">{n}</div>
      <div className="mt-2 label text-[var(--text-3)]">{label}</div>
      {sub && <div className="mt-1 font-mono text-[11px] text-[var(--text-4)]">{sub}</div>}
    </div>
  );
}

function FAQ() {
  const items = [
    {
      q: "Is Tollgate the same thing as faregate?",
      a: (
        <>
          No. faregate is the open protocol. Tollgate is the implementation
          partner that helps you ship it. The protocol is free to adopt; you can
          run it without us. We&apos;re paid only when we help you earn.
        </>
      ),
    },
    {
      q: "What if my legal team prefers stablecoins?",
      a: (
        <>
          We support both. Lightning is the default — open, permissionless,
          ~$0.0001 fees, instant settle. For regulated environments we wire in a
          stablecoin gateway that funnels into your treasury per your compliance
          policy. The protocol is rail-agnostic.
        </>
      ),
    },
    {
      q: "How do you decide which actions to charge for?",
      a: (
        <>
          We segment your traffic into &ldquo;crawler&rdquo;, &ldquo;agent task&rdquo;, and
          &ldquo;human&rdquo; using existing fingerprinting plus usage signals. Charging
          starts on the agent-task tier. Humans see no change. Crawlers see the
          standard 402 challenge — they pay or they don&apos;t.
        </>
      ),
    },
    {
      q: "Can we take it in-house later?",
      a: (
        <>
          Yes. The standard is open, the code we ship lives in your repo, and
          the wallet keys are yours from day one. Most clients keep us on for
          ongoing protocol updates, but it&apos;s not contractual. No lock-in.
        </>
      ),
    },
    {
      q: "What does a typical engagement cost?",
      a: (
        <>
          Zero up-front. We take 10–15% of agent revenue we help generate. No
          retainer, no SOW for the build. If we don&apos;t move money, you owe
          us nothing.
        </>
      ),
    },
  ];
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">Common questions</div>
          <div className="label text-[var(--text-4)]">tollgate / 06</div>
        </div>
        <div className="grid grid-cols-12 gap-8 py-20 sm:py-24">
          <div className="col-span-12 lg:col-span-5">
            <h2 className="display text-[clamp(32px,5vw,56px)] text-zinc-950">
              Things every CTO asks
              <br />
              <span className="text-[var(--text-3)]">on the first call.</span>
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-7">
            <div className="border hairline">
              {items.map((it, i) => (
                <div
                  key={it.q}
                  className={`px-6 py-6 ${i < items.length - 1 ? "border-b hairline" : ""}`}
                >
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-[11px] text-[var(--text-4)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-[16px] font-medium text-zinc-950">{it.q}</h3>
                  </div>
                  <p className="mt-3 pl-7 text-[14.5px] leading-relaxed text-[var(--text-2)]">
                    {it.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="contact" className="border-b hairline bg-zinc-950 text-white">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b border-zinc-800 py-3">
          <div className="label text-zinc-500">Get started</div>
          <div className="label text-zinc-700">tollgate / 07</div>
        </div>
        <div className="grid grid-cols-12 gap-8 py-24 sm:py-32">
          <div className="col-span-12 lg:col-span-7">
            <h2 className="display-tight text-[clamp(40px,7vw,96px)] text-white">
              Twenty minutes
              <br />
              with a senior engineer.
            </h2>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-zinc-400">
              Send your domain. We&apos;ll come back inside 48 hours with three
              concrete paid actions you could be charging for, an estimated
              monthly revenue floor, and a two-week implementation plan. No
              decks. No retainer.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-5 flex items-end">
            <form className="w-full">
              <label className="label block text-zinc-500">Your domain</label>
              <input
                type="text"
                placeholder="your-company.com"
                className="mt-2 w-full border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-[14px] text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
              <label className="label mt-5 block text-zinc-500">Work email</label>
              <input
                type="email"
                placeholder="you@your-company.com"
                className="mt-2 w-full border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-[14px] text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                className="mt-6 w-full bg-white px-4 py-3 text-[14px] font-medium text-zinc-950 hover:bg-zinc-100 transition"
              >
                Request audit →
              </button>
              <p className="mt-3 text-center font-mono text-[11px] text-zinc-600">
                no spam · we reply within 48h
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
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
            <div className="mt-6 display text-[clamp(34px,5vw,60px)] text-zinc-950">
              The agent
              <br />
              economy needs
              <br />
              <span className="text-[var(--text-3)]">an implementation partner.</span>
            </div>
          </div>
          <div className="col-span-6 lg:col-span-2">
            <div className="label text-[var(--text-3)]">Company</div>
            <ul className="mt-4 space-y-2 text-sm text-[var(--text-2)]">
              <li><a className="hover:text-zinc-950" href="#how-we-help">How we help</a></li>
              <li><a className="hover:text-zinc-950" href="#how-it-works">How it works</a></li>
              <li><a className="hover:text-zinc-950" href="#pricing">Pricing</a></li>
              <li><a className="hover:text-zinc-950" href="#contact">Talk to us</a></li>
            </ul>
          </div>
          <div className="col-span-6 lg:col-span-2">
            <div className="label text-[var(--text-3)]">Protocol</div>
            <ul className="mt-4 space-y-2 text-sm text-[var(--text-2)]">
              <li>
                <Link className="hover:text-zinc-950" href="https://faregate.org">
                  faregate.org ↗
                </Link>
              </li>
              <li><span className="text-[var(--text-4)]">Spec — soon</span></li>
              <li><span className="text-[var(--text-4)]">Reference impl — soon</span></li>
            </ul>
          </div>
          <div className="col-span-12 lg:col-span-3">
            <div className="label text-[var(--text-3)]">Address</div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">
              Built in Munich · Operating worldwide
              <br />
              hello@tollgate.dev
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t hairline py-4 text-[12px]">
          <div className="font-mono text-[var(--text-4)]">tollgate / 2026</div>
          <div className="label text-[var(--text-4)]">Implementation partner · faregate</div>
        </div>
      </div>
    </footer>
  );
}

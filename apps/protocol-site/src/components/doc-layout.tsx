import Link from "next/link";

export type TocItem = { id: string; text: string; depth?: number };

const NAV_GROUPS: Array<{ title: string; items: Array<{ href: string; label: string }> }> = [
  {
    title: "Get started",
    items: [
      { href: "/", label: "Introduction" },
      { href: "/quickstart", label: "Quickstart" },
    ],
  },
  {
    title: "Concepts",
    items: [
      { href: "/concepts/manifest", label: "Manifest" },
      { href: "/concepts/actions", label: "Actions" },
      { href: "/concepts/receipts", label: "Receipts" },
      { href: "/concepts/trust", label: "Trust model" },
    ],
  },
  {
    title: "Specification",
    items: [
      { href: "/spec/manifest", label: "manifest.json" },
      { href: "/spec/wire", label: "Wire format" },
      { href: "/spec/receipts", label: "Receipt format" },
    ],
  },
  {
    title: "Resources",
    items: [
      { href: "/examples", label: "Examples" },
      { href: "/conformance", label: "Conformance" },
    ],
  },
];

export function DocLayout({
  children,
  toc,
  activePath,
}: {
  children: React.ReactNode;
  toc?: TocItem[];
  activePath: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <TopNav />
      <div className="mx-auto grid max-w-[1500px] grid-cols-12 gap-x-8 px-6 sm:px-10">
        {/* sidebar */}
        <aside className="col-span-12 border-r-0 lg:col-span-3 lg:border-r hairline lg:pr-8">
          <nav className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-10">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="mb-7">
                <div className="label text-[var(--text-3)] mb-3">{group.title}</div>
                <ul className="space-y-0">
                  {group.items.map((item) => {
                    const active = item.href === activePath;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`block border-l-2 py-1.5 pl-4 text-[14px] transition ${
                            active
                              ? "border-zinc-950 text-zinc-950 font-medium"
                              : "border-transparent text-[var(--text-2)] hover:border-[var(--text-4)] hover:text-zinc-950"
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* content */}
        <article
          className={`col-span-12 py-10 sm:py-14 ${
            toc && toc.length > 0 ? "lg:col-span-7" : "lg:col-span-9"
          }`}
        >
          <div className="prose-doc">{children}</div>
          <DocFooter />
        </article>

        {/* toc */}
        {toc && toc.length > 0 && (
          <aside className="hidden lg:col-span-2 lg:block">
            <div className="sticky top-16 py-10">
              <div className="label text-[var(--text-3)] mb-3">On this page</div>
              <ul className="space-y-1.5 text-[13px]">
                {toc.map((t) => (
                  <li key={t.id} style={{ paddingLeft: (t.depth ?? 0) * 12 }}>
                    <a
                      href={`#${t.id}`}
                      className="text-[var(--text-2)] hover:text-zinc-950 transition"
                    >
                      {t.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b hairline bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-3 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Mark />
          <span className="font-semibold tracking-tight text-zinc-950">agents402</span>
          <span className="ml-1 border hairline px-1.5 py-0.5 label text-[var(--text-3)]">
            v0.1
          </span>
        </Link>
        <nav className="flex items-center gap-7 text-sm">
          <Link className="text-[var(--text-2)] hover:text-zinc-950 transition" href="/quickstart">
            Quickstart
          </Link>
          <Link className="text-[var(--text-2)] hover:text-zinc-950 transition" href="/spec/manifest">
            Spec
          </Link>
          <Link className="text-[var(--text-2)] hover:text-zinc-950 transition" href="/examples">
            Examples
          </Link>
          <a
            href="https://github.com/gereonelvers/tollgate"
            className="font-mono text-[12.5px] text-[var(--text-2)] hover:text-zinc-950 transition"
          >
            GitHub ↗
          </a>
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

function DocFooter() {
  return (
    <div className="mt-20 border-t hairline pt-8">
      <div className="flex items-center justify-between text-[12px]">
        <div className="font-mono text-[var(--text-4)]">agents402.org / 2026</div>
        <div className="label text-[var(--text-4)]">Open protocol · v0.1</div>
      </div>
    </div>
  );
}

export function H1({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h1 id={id} className="display text-[clamp(36px,5vw,52px)] text-zinc-950 mt-2">
      {children}
    </h1>
  );
}

export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="text-[26px] font-semibold tracking-tight text-zinc-950 mt-14 mb-5 scroll-mt-20"
    >
      {children}
    </h2>
  );
}

export function H3({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h3
      id={id}
      className="text-[18px] font-semibold tracking-tight text-zinc-950 mt-10 mb-3 scroll-mt-20"
    >
      {children}
    </h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15.5px] leading-[1.7] text-[var(--text-2)] my-5">{children}</p>;
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-[18px] leading-[1.6] text-[var(--text-2)] mt-5 mb-8">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="my-5 space-y-2 text-[15.5px] leading-[1.7] text-[var(--text-2)]">{children}</ul>
  );
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 pl-1">
      <span className="text-[var(--text-4)] mt-[8px] shrink-0">·</span>
      <span>{children}</span>
    </li>
  );
}

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="border hairline bg-[var(--surface)] px-1.5 py-[1px] font-mono text-[13px] text-zinc-950">
      {children}
    </code>
  );
}

export function CodeBlock({
  children,
  filename,
  lang,
}: {
  children: string;
  filename?: string;
  lang?: string;
}) {
  return (
    <div className="my-6 border hairline bg-[var(--code-bg)] overflow-hidden">
      {(filename || lang) && (
        <div className="flex items-center justify-between border-b border-[var(--code-line)] px-4 py-2">
          <div className="font-mono text-[12px] text-zinc-400">{filename ?? ""}</div>
          {lang && <div className="label text-zinc-600">{lang}</div>}
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-[1.7] font-mono text-zinc-300">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function Callout({
  variant = "note",
  title,
  children,
}: {
  variant?: "note" | "warn" | "tip";
  title?: string;
  children: React.ReactNode;
}) {
  const palette = {
    note: { border: "border-blue-200", bg: "bg-blue-50", label: "text-blue-800", icon: "ⓘ" },
    warn: { border: "border-amber-200", bg: "bg-amber-50", label: "text-amber-800", icon: "▲" },
    tip: { border: "border-emerald-200", bg: "bg-emerald-50", label: "text-emerald-800", icon: "✓" },
  }[variant];
  return (
    <div className={`my-6 border ${palette.border} ${palette.bg} px-5 py-4`}>
      {title && (
        <div className={`label ${palette.label} mb-2 flex items-center gap-2`}>
          <span>{palette.icon}</span>
          {title}
        </div>
      )}
      <div className="text-[14.5px] leading-[1.7] text-zinc-800">{children}</div>
    </div>
  );
}

export function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <div className="my-6 overflow-x-auto border hairline">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b hairline bg-[var(--surface)]">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left label text-[var(--text-3)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i < rows.length - 1 ? "border-b hairline" : ""}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-[var(--text-2)] align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageHeader({ kicker, title, lead }: { kicker: string; title: string; lead: string }) {
  return (
    <header>
      <div className="label text-[var(--text-3)]">{kicker}</div>
      <H1>{title}</H1>
      <Lead>{lead}</Lead>
      <hr className="border-t hairline my-8" />
    </header>
  );
}

export function NextLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block border hairline bg-white px-5 py-4 transition hover:border-zinc-950"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="label text-[var(--text-3)] mb-1">Next</div>
          <div className="text-[16px] font-medium text-zinc-950">{title}</div>
          <div className="mt-1 text-[13px] text-[var(--text-3)]">{description}</div>
        </div>
        <span className="text-[var(--text-3)] group-hover:translate-x-0.5 group-hover:text-zinc-950 transition">
          →
        </span>
      </div>
    </Link>
  );
}

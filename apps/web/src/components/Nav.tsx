import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b hairline bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Mark />
          <span className="font-semibold tracking-tight text-zinc-950">Faregate</span>
          <span className="ml-1 border hairline px-1.5 py-0.5 label text-[var(--text-3)]">
            wallet setup
          </span>
        </Link>
        <nav className="flex items-center gap-7 text-sm">
          <Link href="/wallet" className="text-[var(--text-2)] hover:text-zinc-950 transition">
            Wallet
          </Link>
          <Link href="/developer" className="text-[var(--text-2)] hover:text-zinc-950 transition">
            Developer
          </Link>
          <Link
            href="https://agents402.org"
            className="font-mono text-[12.5px] text-[var(--text-2)] hover:text-zinc-950 transition"
          >
            spec ↗
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Mark() {
  return (
    <span className="grid size-6 place-items-center border hairline-2 bg-zinc-950 text-white">
      <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
        <path d="M3 2h1v12H3zM12 2h1v12h-1zM6 5h4v6H6z" />
      </svg>
    </span>
  );
}

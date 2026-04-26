"use client";

import { useState } from "react";

const DEMO_PROMPT = `Check demo.faregate.org and ask the editor why micropayments finally work in 2026. Pay up to 50 sats if needed.`;

export function DemoPrompt() {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(DEMO_PROMPT).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="border hairline bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b hairline bg-[var(--bg)] px-5 py-2.5">
        <div className="label text-[var(--text-3)]">Try this prompt</div>
        <button
          type="button"
          onClick={copy}
          className="font-mono text-[11px] text-[var(--text-3)] hover:text-zinc-950 transition"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-5 py-4 font-mono text-[13.5px] leading-relaxed text-zinc-950">
        {DEMO_PROMPT}
      </pre>
      <div className="border-t hairline px-5 py-3 text-[13px] leading-relaxed text-[var(--text-2)]">
        <span className="font-medium text-zinc-950">What you should see:</span>{" "}
        Claude calls <code className="font-mono">discover</code> against{" "}
        <a
          href="https://demo.faregate.org"
          className="underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          demo.faregate.org
        </a>
        , finds two paid actions, then{" "}
        <code className="font-mono">pay_and_invoke</code> on{" "}
        <code className="font-mono">ask.site_agent</code>. If no wallet is
        configured yet, it walks you through pairing one. Watch the dashboard
        at{" "}
        <a
          href="https://demo.faregate.org/dashboard"
          className="underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          /dashboard
        </a>{" "}
        to see the sat arrive in real time.
      </div>
    </div>
  );
}

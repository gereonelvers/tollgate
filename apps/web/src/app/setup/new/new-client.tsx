"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { newSparkWallet, saveWallet, type StoredWallet } from "@/lib/storage";
import { createNewSparkWallet, pickConfirmIndices } from "@/lib/spark";

type Phase =
  | { kind: "intro" }
  | { kind: "creating" }
  | { kind: "show-seed"; mnemonic: string; address: string; identity_pubkey: string }
  | {
      kind: "confirm-seed";
      mnemonic: string;
      address: string;
      identity_pubkey: string;
      indices: number[];
      inputs: Record<number, string>;
    }
  | { kind: "sending-to-cli"; callback: string }
  | { kind: "cli-done" }
  | { kind: "cli-failed"; reason: string }
  | { kind: "done" };

export function NewSetup() {
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // CLI-pairing mode: when this page is opened by `npx @agents402/setup`, the
  // CLI passes a callback URL pointing at its localhost listener and a state
  // token. After backup confirmation we POST the wallet config to that URL
  // instead of routing to /wallet — the CLI writes ~/.tollgate/wallet.json.
  const callback = searchParams.get("callback");
  const stateToken = searchParams.get("state");
  const isCliMode = Boolean(callback && stateToken);

  const network: NonNullable<StoredWallet["spark_network"]> =
    (process.env.NEXT_PUBLIC_SPARK_NETWORK as
      | "MAINNET"
      | "REGTEST"
      | "TESTNET"
      | "SIGNET"
      | undefined) ?? "MAINNET";

  async function handleCreate() {
    setError(null);
    setPhase({ kind: "creating" });
    try {
      const r = await createNewSparkWallet(network);
      setPhase({
        kind: "show-seed",
        mnemonic: r.mnemonic,
        address: r.address,
        identity_pubkey: r.identity_pubkey,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase({ kind: "intro" });
    }
  }

  function handleProceedToConfirm() {
    if (phase.kind !== "show-seed") return;
    const words = phase.mnemonic.trim().split(/\s+/);
    const indices = pickConfirmIndices(words.length, 3);
    setPhase({
      kind: "confirm-seed",
      mnemonic: phase.mnemonic,
      address: phase.address,
      identity_pubkey: phase.identity_pubkey,
      indices,
      inputs: {},
    });
  }

  function handleConfirmInput(idx: number, value: string) {
    if (phase.kind !== "confirm-seed") return;
    setPhase({ ...phase, inputs: { ...phase.inputs, [idx]: value } });
  }

  async function handleConfirmSubmit() {
    if (phase.kind !== "confirm-seed") return;
    const words = phase.mnemonic.trim().split(/\s+/);
    for (const i of phase.indices) {
      const expected = words[i]?.toLowerCase().trim();
      const got = phase.inputs[i]?.toLowerCase().trim();
      if (!got || got !== expected) {
        setError(`Word #${i + 1} doesn't match. Check your backup and try again.`);
        return;
      }
    }
    const wallet = newSparkWallet({
      mnemonic: phase.mnemonic,
      network,
      address: phase.address,
      identity_pubkey: phase.identity_pubkey,
    });
    wallet.backup_confirmed = true;
    saveWallet(wallet);

    // CLI-pairing mode: ship the config to the localhost listener and stop.
    if (isCliMode && callback && stateToken) {
      setPhase({ kind: "sending-to-cli", callback });
      try {
        const cliConfig = {
          provider: "spark" as const,
          spark_mnemonic: phase.mnemonic,
          spark_network: network,
          spark_address: phase.address,
          spark_identity_pubkey: phase.identity_pubkey,
          label: "Spark wallet (paired via CLI)",
        };
        const r = await fetch(callback, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-agents402-state": stateToken,
          },
          body: JSON.stringify(cliConfig),
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          setPhase({
            kind: "cli-failed",
            reason: `Localhost listener returned ${r.status}. ${txt.slice(0, 200)}`,
          });
          return;
        }
        setPhase({ kind: "cli-done" });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setPhase({
          kind: "cli-failed",
          reason: `Couldn't reach the CLI listener at ${callback}. ${msg}. The wallet is still saved in your browser; you can also pair it later via the Wallet page.`,
        });
      }
      return;
    }

    // Normal mode: route to wallet page.
    setPhase({ kind: "done" });
    router.push("/wallet");
  }

  if (phase.kind === "sending-to-cli") {
    return (
      <Section eyebrow="Linking" title="Sending wallet to your terminal…" foot="setup / 02 — CLI pairing">
        <Loading
          steps={[
            "Browser: POSTing wallet config to the localhost listener",
            "CLI: writing ~/.tollgate/wallet.json",
            "Almost done…",
          ]}
        />
      </Section>
    );
  }

  if (phase.kind === "cli-done") {
    return (
      <Section eyebrow="Linked" title="Your wallet is paired with the MCP." foot="setup / 02 — done">
        <div className="border hairline bg-emerald-50 p-7">
          <div className="label text-emerald-800">Wallet linked successfully</div>
          <p className="mt-3 text-[14.5px] leading-relaxed text-emerald-900">
            The setup CLI has written the wallet config to{" "}
            <code className="font-mono text-emerald-950">~/.tollgate/wallet.json</code>.
            Return to your terminal — the CLI will exit on its own. You can
            close this tab.
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-emerald-900">
            The same wallet is also saved in this browser so you can manage it
            from <Link href="/wallet" className="underline underline-offset-4">/wallet</Link>.
          </p>
        </div>
      </Section>
    );
  }

  if (phase.kind === "cli-failed") {
    return (
      <Section eyebrow="Pairing failed" title="Couldn't reach the CLI." foot="setup / 02 — error">
        <div className="border border-rose-200 bg-rose-50 p-7">
          <div className="label text-rose-800">Pairing error</div>
          <p className="mt-3 text-[14.5px] leading-relaxed text-rose-900">{phase.reason}</p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-rose-900">
            The wallet is still saved in this browser. You can re-run{" "}
            <code className="font-mono">npx @agents402/setup</code> and try
            again, or pair it manually from the Wallet page.
          </p>
          <Link
            href="/wallet"
            className="mt-5 inline-block border hairline bg-zinc-950 px-4 py-2.5 text-[13px] text-white hover:bg-zinc-800 transition"
          >
            Go to wallet →
          </Link>
        </div>
      </Section>
    );
  }

  if (phase.kind === "creating") {
    return (
      <Section eyebrow="Creating wallet" title="Generating your keys…" foot="setup / 02">
        <Loading
          steps={[
            "Deriving fresh mnemonic in your browser",
            "Initializing Spark wallet",
            "Fetching your address from the operator network",
          ]}
        />
      </Section>
    );
  }

  if (phase.kind === "show-seed") {
    return (
      <Section eyebrow="Backup" title="Write these 12 words down." foot="setup / 02 — backup">
        <div className="border hairline bg-[var(--surface)] p-6">
          <div className="label text-[var(--text-3)] mb-3">Recovery phrase · order matters</div>
          <SeedGrid mnemonic={phase.mnemonic} />
          <div className="mt-6 border-t hairline pt-5 text-[13.5px] leading-relaxed text-[var(--text-2)]">
            <p>
              <strong className="text-zinc-950">This is your wallet.</strong>{" "}
              Anyone with these 12 words can spend your sats. We don&apos;t have
              a copy. Lose them and the wallet is gone forever.
            </p>
            <p className="mt-3">
              Write them on paper. Don&apos;t screenshot. Don&apos;t paste into
              chat. Don&apos;t put them in a password manager that syncs to a
              service you don&apos;t fully trust.
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-4">
          <button
            onClick={() => setPhase({ kind: "intro" })}
            className="text-[13px] text-[var(--text-3)] hover:text-zinc-950 transition"
          >
            ← cancel
          </button>
          <button
            onClick={handleProceedToConfirm}
            className="border hairline bg-zinc-950 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition"
          >
            I&apos;ve written them down →
          </button>
        </div>
      </Section>
    );
  }

  if (phase.kind === "confirm-seed") {
    const words = phase.mnemonic.trim().split(/\s+/);
    return (
      <Section
        eyebrow="Confirm backup"
        title="Type the words at these positions."
        foot="setup / 02 — confirm"
      >
        <div className="border hairline bg-white p-7">
          <p className="text-[14px] leading-relaxed text-[var(--text-2)]">
            We&apos;ll only enable the wallet if you can prove you have the
            backup written down. Three random word positions:
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {phase.indices.map((i) => (
              <label key={i} className="block">
                <div className="label text-[var(--text-3)] mb-2">Word #{i + 1}</div>
                <input
                  value={phase.inputs[i] ?? ""}
                  onChange={(e) => handleConfirmInput(i, e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full border hairline bg-[var(--bg-2)] px-3 py-2.5 font-mono text-[14px] text-zinc-950 focus:border-zinc-700 focus:outline-none"
                />
              </label>
            ))}
          </div>

          {error && (
            <div className="mt-5 border border-rose-200 bg-rose-50 px-4 py-3 text-[13.5px] text-rose-800">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t hairline pt-5">
            <button
              onClick={() =>
                setPhase({
                  kind: "show-seed",
                  mnemonic: phase.mnemonic,
                  address: phase.address,
                  identity_pubkey: phase.identity_pubkey,
                })
              }
              className="text-[13px] text-[var(--text-3)] hover:text-zinc-950 transition"
            >
              ← show me again
            </button>
            <button
              onClick={handleConfirmSubmit}
              disabled={phase.indices.some((i) => !phase.inputs[i])}
              className="border hairline bg-zinc-950 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition disabled:opacity-30 disabled:hover:bg-zinc-950"
            >
              Confirm + activate →
            </button>
          </div>
          <p className="mt-3 text-[12px] text-[var(--text-3)]">
            Hint — total mnemonic length: {words.length} words.
          </p>
        </div>
      </Section>
    );
  }

  // intro
  return (
    <Section
      eyebrow={isCliMode ? "Create + link wallet" : "Create new wallet"}
      title={
        <>
          A self-custodial wallet,
          <br />
          <span className="text-[var(--text-3)]">
            {isCliMode ? "linked straight to your terminal." : "in your browser, in 60 seconds."}
          </span>
        </>
      }
      foot={isCliMode ? "setup / 02 — CLI pairing" : "setup / 02 — Spark · self-custodial"}
    >
      {isCliMode && (
        <div className="mb-6 border hairline bg-[var(--surface)] px-5 py-4 font-mono text-[12.5px] text-[var(--text-2)]">
          <span className="label text-[var(--text-3)] mr-3">CLI</span>
          Your <code className="text-zinc-950">npx @agents402/setup</code> session
          is listening on{" "}
          <code className="text-zinc-950">{callback}</code>. After you create the
          wallet, the config will be sent there automatically.
        </div>
      )}
      <div className="grid gap-px border hairline bg-[var(--line)] sm:grid-cols-3">
        <FactCard
          n="i"
          title="Self-custodial"
          body="Your 12-word seed is generated in this browser tab. We never see it. Cryptographically, you hold the keys."
        />
        <FactCard
          n="ii"
          title="Lightning, no channels"
          body="Spark fronts inbound liquidity through its operator network. No 10-minute first-payment dance, no channel-open fees."
        />
        <FactCard
          n="iii"
          title="Sponsored start"
          body="We&apos;ll send you ~50 sats from our faucet so you can immediately pay your first paywall without funding a wallet first."
        />
      </div>

      {error && (
        <div className="mt-6 border border-rose-200 bg-rose-50 px-4 py-3 text-[13.5px] text-rose-800">
          {error}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between border-t hairline pt-6">
        <Link
          href="/"
          className="text-[13px] text-[var(--text-3)] hover:text-zinc-950 transition"
        >
          ← all setup options
        </Link>
        <button
          onClick={handleCreate}
          className="border hairline bg-zinc-950 px-6 py-3 text-[14px] font-medium text-white hover:bg-zinc-800 transition"
        >
          Create my wallet →
        </button>
      </div>

      <div className="mt-10 border-t hairline pt-6 text-[12.5px] leading-relaxed text-[var(--text-3)]">
        Spark trust model: 1-of-n honest operator. As long as one Spark
        operator deletes prior key material honestly, your funds can&apos;t be
        stolen. You can always exit unilaterally to L1 with pre-signed
        transactions. Cryptographically defensible; not magic.{" "}
        <a
          href="https://docs.spark.money/wallets/overview"
          className="border-b border-zinc-300 text-zinc-950 hover:border-zinc-950 transition"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read more
        </a>
        .
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  eyebrow,
  title,
  children,
  foot,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children: React.ReactNode;
  foot: string;
}) {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-b hairline py-3">
          <div className="label text-[var(--text-3)]">{eyebrow}</div>
          <div className="label text-[var(--text-4)]">{foot}</div>
        </div>
        <div className="grid grid-cols-12 gap-x-8 py-16">
          <div className="col-span-12 lg:col-span-5">
            <h1 className="display text-[clamp(32px,5vw,52px)] text-zinc-950">{title}</h1>
          </div>
          <div className="col-span-12 lg:col-span-7">{children}</div>
        </div>
      </div>
    </section>
  );
}

function FactCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="bg-[var(--bg)] p-6">
      <div className="font-mono text-[11px] text-[var(--text-4)]">{n}.</div>
      <div className="mt-3 text-[16px] font-medium text-zinc-950">{title}</div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-2)]">{body}</p>
    </div>
  );
}

function SeedGrid({ mnemonic }: { mnemonic: string }) {
  const words = mnemonic.trim().split(/\s+/);
  return (
    <div className="grid grid-cols-3 gap-px bg-[var(--line)] sm:grid-cols-4">
      {words.map((w, i) => (
        <div
          key={i}
          className="flex items-baseline gap-3 bg-[var(--bg)] px-3 py-2.5 font-mono text-[14px] text-zinc-950"
        >
          <span className="w-5 text-right text-[11px] tabular text-[var(--text-4)]">{i + 1}.</span>
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

function Loading({ steps }: { steps: string[] }) {
  return (
    <div className="border hairline bg-white p-7">
      <ul className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" />
            <span className="text-[14px] text-zinc-950">{s}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 font-mono text-[12px] text-[var(--text-3)]">
        Connecting to Spark operators on the configured network. First load can
        take 5–10 s as the WASM bundle initializes.
      </div>
    </div>
  );
}

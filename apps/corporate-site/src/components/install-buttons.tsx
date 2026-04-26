"use client";

import { useState } from "react";

/**
 * One-click install snippet for the @agents402/mcp reference server.
 *
 * - Cursor uses the documented deeplink scheme (one click → app prompt).
 * - Claude Code installs via its `claude mcp add` CLI (one terminal command).
 * - Claude Desktop has no deeplink yet, so we offer a copy-to-clipboard for the
 *   JSON snippet plus the OS-specific config file path.
 */

const SERVER_NAME = "faregate";
const NPM_PACKAGE = "@agents402/mcp";

const SERVER_CONFIG = {
  command: "npx",
  args: ["-y", NPM_PACKAGE],
};

const FULL_CONFIG = {
  mcpServers: {
    [SERVER_NAME]: SERVER_CONFIG,
  },
};

const CONFIG_JSON = JSON.stringify(FULL_CONFIG, null, 2);
const CLAUDE_CODE_CMD = `claude mcp add ${SERVER_NAME} -- npx -y ${NPM_PACKAGE}`;

// Pre-computed: base64 of JSON.stringify({ command: "npx", args: ["-y", "@agents402/mcp"] })
const CURSOR_CONFIG_B64 =
  "eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBhZ2VudHM0MDIvbWNwIl19";
const CURSOR_DEEPLINK = `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_NAME}&config=${CURSOR_CONFIG_B64}`;

export function InstallButtons() {
  const [copied, setCopied] = useState<"cmd" | "json" | null>(null);

  function copy(key: "cmd" | "json", text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    });
  }

  return (
    <div className="my-8 border hairline overflow-hidden">
      <div className="grid grid-cols-1 gap-px bg-[var(--line)] sm:grid-cols-3">
        <a
          href={CURSOR_DEEPLINK}
          className="group flex flex-col gap-2 bg-[var(--bg)] px-5 py-5 transition hover:bg-[var(--bg-2)]"
        >
          <div className="flex items-center justify-between">
            <span className="label text-[var(--text-3)]">Cursor</span>
            <span className="font-mono text-[10.5px] text-emerald-700">one click</span>
          </div>
          <div className="text-[15px] font-medium text-zinc-950">Add to Cursor</div>
          <div className="text-[12px] text-[var(--text-3)] leading-snug">
            Opens Cursor and prompts you to confirm. Uses the documented{" "}
            <code className="font-mono">cursor://</code> deeplink.
          </div>
          <div className="mt-1 text-[11.5px] font-mono text-zinc-950 group-hover:translate-x-0.5 transition">
            install →
          </div>
        </a>

        <button
          type="button"
          onClick={() => copy("cmd", CLAUDE_CODE_CMD)}
          className="group flex flex-col gap-2 bg-[var(--bg)] px-5 py-5 text-left transition hover:bg-[var(--bg-2)]"
        >
          <div className="flex items-center justify-between">
            <span className="label text-[var(--text-3)]">Claude Code</span>
            <span className="font-mono text-[10.5px] text-emerald-700">
              {copied === "cmd" ? "copied ✓" : "one command"}
            </span>
          </div>
          <div className="text-[15px] font-medium text-zinc-950">Add to Claude Code</div>
          <div className="text-[12px] text-[var(--text-3)] leading-snug">
            Copies <code className="font-mono">claude mcp add</code> command — paste in your terminal.
          </div>
          <div className="mt-1 text-[11.5px] font-mono text-zinc-950 group-hover:translate-x-0.5 transition">
            copy command →
          </div>
        </button>

        <button
          type="button"
          onClick={() => copy("json", CONFIG_JSON)}
          className="group flex flex-col gap-2 bg-[var(--bg)] px-5 py-5 text-left transition hover:bg-[var(--bg-2)]"
        >
          <div className="flex items-center justify-between">
            <span className="label text-[var(--text-3)]">Claude Desktop</span>
            <span className="font-mono text-[10.5px] text-emerald-700">
              {copied === "json" ? "copied ✓" : "copy + paste"}
            </span>
          </div>
          <div className="text-[15px] font-medium text-zinc-950">Add to Claude Desktop</div>
          <div className="text-[12px] text-[var(--text-3)] leading-snug">
            Copies the JSON. Paste into your{" "}
            <code className="font-mono">claude_desktop_config.json</code>, restart.
          </div>
          <div className="mt-1 text-[11.5px] font-mono text-zinc-950 group-hover:translate-x-0.5 transition">
            copy config →
          </div>
        </button>
      </div>

      <details className="border-t hairline">
        <summary className="cursor-pointer px-5 py-3 font-mono text-[12px] text-[var(--text-3)] hover:text-zinc-950 transition">
          show config + manual install paths
        </summary>
        <div className="border-t hairline bg-[var(--code-bg)]">
          <pre className="overflow-x-auto px-5 py-4 text-[12.5px] leading-[1.7] font-mono text-zinc-300">
            <code>{CONFIG_JSON}</code>
          </pre>
        </div>
        <div className="border-t hairline px-5 py-4 text-[13px] leading-relaxed text-[var(--text-2)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="label text-[var(--text-3)]">Claude Desktop · macOS</div>
              <code className="mt-1 block font-mono text-[11.5px] text-zinc-950 break-all">
                ~/Library/Application Support/Claude/claude_desktop_config.json
              </code>
            </div>
            <div>
              <div className="label text-[var(--text-3)]">Claude Desktop · Windows</div>
              <code className="mt-1 block font-mono text-[11.5px] text-zinc-950 break-all">
                %APPDATA%\Claude\claude_desktop_config.json
              </code>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] text-[var(--text-3)]">
            Already have <code className="font-mono">mcpServers</code>? Merge the{" "}
            <code className="font-mono">faregate</code> key in alongside your other
            servers — don&apos;t overwrite the whole file.
          </p>
        </div>
      </details>
    </div>
  );
}

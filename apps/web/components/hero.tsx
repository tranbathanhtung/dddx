"use client";

import Image from "next/image";
import { useState, useCallback, type ReactNode } from "react";

const INSTALL_COMMANDS: Record<string, string> = {
  curl: "curl -fsSL https://dddx.dev/install | bash",
  npm: "npm install -g @dddx/cli",
  bun: "bun install -g @dddx/cli",
  pnpm: "pnpm install -g @dddx/cli",
};

const AGENTS = [
  {
    name: "Cursor",
    icon: "https://cdn.agentclientprotocol.com/registry/v1/latest/cursor.svg",
  },
  {
    name: "Claude Code",
    icon: "https://cdn.agentclientprotocol.com/registry/v1/latest/claude-acp.svg",
  },
  {
    name: "OpenCode",
    icon: "https://cdn.agentclientprotocol.com/registry/v1/latest/opencode.svg",
  },
  {
    name: "Codex",
    icon: "https://cdn.agentclientprotocol.com/registry/v1/latest/codex-acp.svg",
  },
];

function Logo() {
  return (
    <a href="#" aria-label="Home">
      <div className="border-background bg-linear-to-b rounded-lg text-orange-100 relative flex size-9 translate-y-0.5 items-center justify-center border from-yellow-300 to-orange-500 shadow-lg shadow-black/20 ring-1 ring-black/10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 9h.01" />
          <path d="M14 9h.01" />
          <path d="M12 3a7 7 0 0 1 7 7v1l1 0a2 2 0 1 1 0 4l-1 0v3l2 3h-10a6 6 0 0 1 -6 -5.775l0 -.226l-1 0a2 2 0 0 1 0 -4l1 0v-1a7 7 0 0 1 7 -7l0 .001" />
          <path d="M11 14h2a1 1 0 0 0 -2 0" />
        </svg>
      </div>
    </a>
  );
}

function Nav() {
  return (
    <nav
      className="flex items-center gap-[clamp(16px,2vw,28px)]"
      aria-label="Main"
    >
      {["Docs", "GitHub"].map((label) => (
        <a
          key={label}
          className="text-sm font-medium text-[var(--text-muted)] no-underline transition-colors hover:text-[var(--text)] focus-visible:text-[var(--text)] focus-visible:outline-none"
          href="https://github.com/tranbathanhtung/dddx"
          target="_blank"
          rel="noopener noreferrer"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

function InstallWidget({
  activeTab,
  onTabChange,
  onCopy,
  copied,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const tabs = ["curl", "npm", "bun", "pnpm"];

  return (
    <div className="border border-[var(--border)] rounded-xl bg-[var(--bg-muted)] overflow-hidden max-w-full">
      <div
        className="flex gap-1 px-4 pt-3 border-b border-[var(--border)] overflow-x-auto"
        role="tablist"
        aria-label="Install methods"
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            role="tab"
            aria-selected={activeTab === tab}
            className={`font-mono text-xs px-3 pb-[10px] pt-2 cursor-pointer whitespace-nowrap border-0 border-b-2 bg-transparent mb-[-1px] transition-colors ${
              activeTab === tab
                ? "text-[var(--text)] font-medium border-b-[var(--text)]"
                : "text-[var(--text-muted)] border-b-transparent hover:text-[var(--text)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 px-4 py-[14px]">
        <code className="flex-1 font-mono text-xs leading-5 text-[var(--text)] overflow-x-auto whitespace-nowrap">
          {INSTALL_COMMANDS[activeTab]}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 border-none rounded-lg bg-transparent text-[var(--text-muted)] cursor-pointer transition-colors hover:bg-black/5 hover:text-[var(--text)] focus-visible:outline-none"
          aria-label={copied ? "Copied!" : "Copy install command"}
        >
          {copied ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M13 4L6 12L3 8.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="5.5"
                y="5.5"
                width="8"
                height="8"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.25"
              />
              <path
                d="M3.5 10.5H3C2.17157 10.5 1.5 9.82843 1.5 9V3C1.5 2.17157 2.17157 1.5 3 1.5H9C9.82843 1.5 10.5 2.17157 10.5 3V3.5"
                stroke="currentColor"
                strokeWidth="1.25"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function TerminalBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-md border border-zinc-700/70 bg-black px-2 py-0.5">
      {children}
    </span>
  );
}

function TerminalHeader() {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800/90 bg-black px-3 py-2 sm:px-4"
      aria-hidden="true"
    >
      <TerminalBadge>
        <svg
          viewBox="0 0 16 16"
          className="size-3 shrink-0 text-lime-400"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8.001 1.2 2.4 4.8v6.4l5.601 3.6 5.6-3.6V4.8L8.001 1.2Zm0 1.38 4.22 2.72v5.4L8 13.42l-4.22-2.72v-5.4L8 2.58Z" />
          <path d="M6.2 10.1V5.9h.55l2.45 2.82V5.9h.55v4.2h-.55L6.75 7.28v2.82H6.2Z" />
        </svg>
        <span className="text-[10px] text-lime-400 sm:text-[11px]">
          v24.0.0
        </span>
      </TerminalBadge>

      <TerminalBadge>
        <svg
          viewBox="0 0 16 16"
          className="size-3 shrink-0 text-zinc-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          aria-hidden="true"
        >
          <path d="M2.5 4.5A1 1 0 0 1 3.5 3.5h3.17l1 1H12.5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7Z" />
        </svg>
        <span className="max-w-[9rem] truncate text-[10px] text-zinc-200 sm:max-w-none sm:text-[11px]">
          ~/Projects/my-app
        </span>
      </TerminalBadge>

      <TerminalBadge>
        <svg
          viewBox="0 0 16 16"
          className="size-3 shrink-0 text-lime-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          aria-hidden="true"
        >
          <circle cx="4.5" cy="4" r="1.25" />
          <circle cx="4.5" cy="12" r="1.25" />
          <path d="M4.5 5.25v2.5M4.5 7.75c0 1.5 2 2.25 4 2.25" />
          <circle cx="11.5" cy="10" r="1.25" />
        </svg>
        <span className="text-[10px] text-lime-400 sm:text-[11px]">main</span>
      </TerminalBadge>
    </div>
  );
}

function Terminal() {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-[10px] border border-zinc-800 bg-[#161616] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <TerminalHeader />
      <div className="px-3 py-2.5 font-mono text-[11px] leading-[1.55] sm:px-4 sm:py-3 sm:text-xs">
        <div className="-mx-3 flex min-w-0 items-center gap-1.5 bg-[#3b1219] px-3 py-1 sm:-mx-4 sm:gap-2 sm:px-4">
          <span
            className="shrink-0 select-none text-[#ff7b72]"
            aria-hidden="true"
          >
            -
          </span>
          <span className="min-w-0 truncate text-[#ffa198] line-through decoration-[#ff7b72]/70">
            npm run dev
          </span>
        </div>
        <div className="-mx-3 flex min-w-0 items-center gap-1.5 bg-[#1a3a2a] px-3 py-1 sm:-mx-4 sm:gap-2 sm:px-4">
          <span
            className="shrink-0 select-none text-[#7ee787]"
            aria-hidden="true"
          >
            +
          </span>
          <span className="min-w-0 truncate font-medium text-[#aff5b4]">
            dddx
          </span>
        </div>

        <div className="mt-2 flex min-w-0 items-start gap-1.5 pl-2 text-[10px] text-zinc-400 sm:gap-2 sm:pl-4 sm:text-[11px]">
          <span
            className="mt-px shrink-0 font-semibold text-emerald-400"
            aria-hidden="true"
          >
            &#10003;
          </span>
          <span className="min-w-0 break-words">
            Studio ready at{" "}
            <span className="text-sky-400 underline decoration-sky-400/30 underline-offset-2">
              localhost:4723
            </span>
          </span>
        </div>

        <p className="mt-2.5 border-t border-zinc-800/80 pt-2 text-[10px] leading-snug text-balance text-zinc-500 sm:mt-3 sm:pt-2.5 sm:text-[11px]">
          Run <code className="font-mono text-zinc-400">dddx</code> in your
          project to turn it into a design studio.
        </p>
      </div>
    </div>
  );
}

export function Hero() {
  const [activeTab, setActiveTab] = useState("curl");
  const [copied, setCopied] = useState(false);

  const copyInstallCommand = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        INSTALL_COMMANDS[activeTab] ?? INSTALL_COMMANDS.curl,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }, [activeTab]);

  return (
    <div className="grid min-h-screen w-full grid-cols-[minmax(0,42fr)_minmax(0,58fr)] max-[900px]:grid-cols-[minmax(0,1fr)] max-[900px]:grid-rows-[auto_auto]">
      <section className="flex flex-col min-w-0 px-[clamp(20px,3vw,48px)] py-[clamp(16px,2vw,32px)] bg-[var(--bg)] border-r border-[var(--border)]">
        <header className="flex items-center justify-between gap-6 mb-[clamp(20px,3vh,40px)]">
          <Logo />
          <Nav />
        </header>

        <div className="flex flex-col max-w-[30rem] w-full my-auto">
          <h1 className="text-5xl font-medium tracking-[-0.03em] leading-[1.1] text-balance text-[var(--text)]">
            Design where you{" "}
            <em className="italic text-[var(--text-muted)]">code</em>
          </h1>
          <p className="mt-4 mb-6 text-base leading-normal text-[var(--text-muted)] text-balance max-w-[42ch]">
            An AI design agent that lives in your repo and browser. Works with
            your favorite coding agent &mdash; Open-source Claude Design/Google
            Stitch.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyInstallCommand}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-zinc-900/20 active:translate-y-px"
            >
              {copied ? "Copied!" : "Get Started"}
            </button>
            <a
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border-0 bg-transparent px-4 text-sm font-medium text-[var(--text)] no-underline shadow-none transition-colors hover:bg-[var(--bg-muted)] focus-visible:outline-none active:translate-y-px"
              href="https://github.com/tranbathanhtung/dddx"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentation
            </a>
          </div>

          <div className="mt-4">
            <InstallWidget
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onCopy={copyInstallCommand}
              copied={copied}
            />
          </div>

          <p className="mt-4 text-sm text-[var(--text-muted)] leading-[1.5]">
            <span className="block text-xs font-medium tracking-[0.08em] mb-1.5 text-black/50">
              Works with
            </span>
            <span className="inline-flex flex-wrap items-center gap-2">
              {AGENTS.map((agent, i) => (
                <span
                  key={agent.name}
                  className="inline-flex items-center gap-1"
                >
                  {i > 0 && (
                    <span className="text-zinc-300 sm:inline-block hidden mx-1">
                      &middot;
                    </span>
                  )}
                  <img src={agent.icon} alt="" className="w-4 h-4 rounded" />
                  {agent.name}
                </span>
              ))}
            </span>
          </p>
        </div>
      </section>

      <section
        className="flex min-w-0 w-full items-center justify-center bg-cover bg-center max-[900px]:items-start max-[900px]:border-t max-[900px]:border-[var(--border)]"
        style={{ backgroundImage: "url(/hero-bg.png)" }}
        aria-label="App preview"
      >
        <div className="flex min-w-0 w-full max-w-[min(100%,1020px)] flex-col gap-2 mx-auto p-[clamp(12px,2vw,32px)]">
          <div className="relative w-full overflow-hidden rounded-lg shadow-lg shadow-black/20 ring-1 ring-black/10 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_rgba(0,0,0,0.06)] aspect-[3456/1926]">
            <Image
              src="/app.png"
              alt="dddx Studio with landing page preview and design canvas"
              fill
              className="object-contain"
              sizes="(max-width: 900px) 100vw, 58vw"
              priority
            />
          </div>
          <Terminal />
        </div>
      </section>
    </div>
  );
}

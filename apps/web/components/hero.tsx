"use client";

import Image from "next/image";
import {
  useState,
  useEffect,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TerminalStep = {
  text: string;
  variant: "muted" | "active";
  hold: number;
  output?: {
    message: string;
    highlight?: string;
  };
};

const TERMINAL_SEQUENCE: TerminalStep[] = [
  {
    text: "npm run dev",
    variant: "muted",
    hold: 900,
    output: {
      message: "Dev server at",
      highlight: "localhost:3000",
    },
  },
  {
    text: "dddx",
    variant: "active",
    hold: 0,
    output: {
      message: "Studio ready at",
      highlight: "localhost:4723",
    },
  },
];

async function typeText(
  setText: Dispatch<SetStateAction<string>>,
  text: string,
  speed: number,
  isRunning: () => boolean,
) {
  setText("");
  for (const char of text) {
    if (!isRunning()) return;
    setText((current) => current + char);
    await sleep(speed);
  }
}

async function deleteText(
  setText: Dispatch<SetStateAction<string>>,
  isRunning: () => boolean,
  speed = 35,
) {
  while (isRunning()) {
    let empty = false;
    setText((current) => {
      if (current.length === 0) {
        empty = true;
        return current;
      }
      return current.slice(0, -1);
    });
    if (empty) return;
    await sleep(speed);
  }
}

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

function Terminal() {
  const [typed, setTyped] = useState("");
  const [variant, setVariant] = useState<"default" | "muted" | "active">(
    "default",
  );
  const [showCursor, setShowCursor] = useState(true);
  const [output, setOutput] = useState<TerminalStep["output"]>(
    TERMINAL_SEQUENCE[0]?.output,
  );

  useEffect(() => {
    let running = true;
    const isRunning = () => running;

    async function runLoop() {
      while (isRunning()) {
        setShowCursor(true);
        setVariant("default");
        setOutput(TERMINAL_SEQUENCE[0]?.output);

        for (let i = 0; i < TERMINAL_SEQUENCE.length; i++) {
          if (!isRunning()) return;
          const step = TERMINAL_SEQUENCE[i]!;

          if (i > 0) {
            await deleteText(setTyped, isRunning, 30);
            await sleep(120);
          }

          await typeText(
            setTyped,
            step.text,
            step.variant === "active" ? 90 : 45,
            isRunning,
          );
          setVariant(step.variant);
          if (step.output) {
            setOutput(step.output);
          }

          if (step.hold) {
            await sleep(step.hold);
          }
        }

        if (!isRunning()) return;
        setShowCursor(false);
        await sleep(2000);
      }
    }

    void runLoop();

    return () => {
      running = false;
    };
  }, []);

  const typedClassName =
    variant === "muted"
      ? "text-zinc-500 line-through decoration-zinc-500"
      : variant === "active"
        ? "text-zinc-50 font-semibold"
        : "text-zinc-300";

  return (
    <div
      className="shrink-0 min-h-[68px] rounded-[10px] border border-zinc-700 bg-zinc-900 px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
      aria-live="polite"
    >
      <div className="flex min-h-[18px] items-center gap-2 font-mono text-xs leading-[1.4]">
        <span className="shrink-0 select-none text-zinc-600" aria-hidden="true">
          $
        </span>
        <span className={`whitespace-nowrap ${typedClassName}`}>{typed}</span>
        <span
          className={`inline-block h-3.5 w-[7px] rounded-[1px] bg-blue-400 animate-[blink_1s_step-end_infinite] ${
            showCursor ? "" : "opacity-0"
          }`}
          aria-hidden="true"
        />
      </div>
      {output ? (
        <div className="mt-1.5 flex items-center gap-2 pl-3.5 text-[11px] text-zinc-400">
          <span
            className="shrink-0 font-semibold text-green-400"
            aria-hidden="true"
          >
            &#10003;
          </span>
          <span>
            {output.message}{" "}
            {output.highlight ? (
              <span className="text-blue-300">{output.highlight}</span>
            ) : null}
          </span>
        </div>
      ) : null}
      <p className="mt-2 px-1 text-[11px] leading-snug text-zinc-500">
        Run <code className="font-mono text-zinc-400">dddx</code> in your
        project to turn it into a design studio.
      </p>
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
    <div className="grid min-h-screen w-full grid-cols-[minmax(0,42fr)_minmax(0,58fr)] max-[900px]:grid-cols-[minmax(0,1fr)] max-[900px]:grid-rows-[auto_minmax(260px,38vh)]">
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
        className="flex min-w-0 w-full items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: "url(/hero-bg.png)" }}
        aria-label="App preview"
      >
        <div className="flex flex-col gap-2 w-full max-w-[min(100%,1020px)] mx-auto p-[clamp(16px,2vw,32px)]">
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

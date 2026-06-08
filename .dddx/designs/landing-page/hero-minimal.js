const INSTALL_COMMANDS = {
  curl: "curl -fsSL https://dddx.dev/install | bash",
  npm: "npm install -g @dddx/cli",
  bun: "bun install -g @dddx/cli",
  brew: "brew install dddx",
  paru: "paru -S dddx-cli-bin",
};

function initInstallBlock(root) {
  const tabs = root.querySelectorAll("[data-tab]");
  const commandEl = root.querySelector("[data-command]");
  const copyBtn = root.querySelector("[data-copy]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.tab;
      if (!INSTALL_COMMANDS[key]) return;

      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
      });

      commandEl.textContent = INSTALL_COMMANDS[key];
    });
  });

  copyBtn.addEventListener("click", async () => {
    const text = commandEl.textContent;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.classList.add("is-copied");
      copyBtn.setAttribute("aria-label", "Copied!");
      setTimeout(() => {
        copyBtn.classList.remove("is-copied");
        copyBtn.setAttribute("aria-label", "Copy install command");
      }, 2000);
    } catch {
      copyBtn.setAttribute("aria-label", "Copy failed");
    }
  });
}

document.querySelectorAll("[data-install]").forEach(initInstallBlock);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeText(el, text, speed = 55) {
  el.textContent = "";
  for (const char of text) {
    el.textContent += char;
    await sleep(speed);
  }
}

async function deleteText(el, speed = 35) {
  while (el.textContent.length > 0) {
    el.textContent = el.textContent.slice(0, -1);
    await sleep(speed);
  }
}

function initTerminal(root) {
  const typedEl = root.querySelector("[data-typed]");
  const cursorEl = root.querySelector("[data-cursor]");
  const outputRow = root.querySelector("[data-output]");
  const outputText = root.querySelector("[data-output-text]");

  if (!typedEl || !cursorEl) return;

  const sequence = [
    { text: "npm run dev", className: "is-muted", hold: 900 },
    { text: "bun run dev", className: "is-muted", hold: 700 },
    { text: "dddx", className: "is-active", hold: 0 },
  ];

  async function runLoop() {
    outputRow.hidden = true;
    outputRow.classList.remove("is-visible");
    cursorEl.classList.remove("is-hidden");

    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      typedEl.className = "terminal__typed";

      if (i > 0) {
        await deleteText(typedEl, 30);
        await sleep(120);
      }

      await typeText(typedEl, step.text, step.className === "is-active" ? 90 : 45);

      if (step.className) {
        typedEl.classList.add(step.className);
      }

      if (step.hold) {
        await sleep(step.hold);
      }
    }

    cursorEl.classList.add("is-hidden");
    outputText.innerHTML =
      'Studio ready at <span class="terminal__url">localhost:4723</span>';
    outputRow.hidden = false;
    requestAnimationFrame(() => outputRow.classList.add("is-visible"));

    await sleep(3200);
    runLoop();
  }

  runLoop();
}

const terminal = document.querySelector("[data-terminal]");
if (terminal) initTerminal(terminal);

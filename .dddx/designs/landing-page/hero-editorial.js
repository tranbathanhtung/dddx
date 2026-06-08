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

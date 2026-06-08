// ─── Custom Loading Element ─────────────────────────────────────────────────────
export const LOADING_TAG = "dddx-loading";

type Theme = "light" | "dark";

/** Matches zustand persist key + shape in `store/index.ts`. */
export function readBootTheme(): Theme {
  if (typeof window === "undefined") return "light";

  try {
    const raw = localStorage.getItem("dddx");
    if (raw) {
      const parsed = JSON.parse(raw) as {
        state?: { ui?: { theme?: Theme } };
      };
      const theme = parsed?.state?.ui?.theme;
      if (theme === "dark" || theme === "light") return theme;
    }
  } catch {
    // ignore malformed storage
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyBootTheme(theme: Theme = readBootTheme()): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export class DddxLoading extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.classList.toggle("dark", readBootTheme() === "dark");
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;

    const style = document.createElement("style");
    style.textContent = `
      :host {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: "Inter", system-ui, -apple-system, sans-serif;
        background: #fff;
        color: #000;
        line-height: 1.5;
        color-scheme: light;
      }
      :host(.dark) {
        background: #000000;
        color: #fafafa;
        color-scheme: dark;
      }
      .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 32px;
      }
      .brand {
        text-align: center;
      }
      .brand p { margin: 0; }
      .brand .company {
        font-size: 16px;
      }
      .brand .company .copyright {
        font-size: 10px;
        position: relative;
        top: -4px;
        margin-left: 2px;
      }
      .brand .title {
        font-size: 48px;
        font-weight: bold;
        margin: 4px 0;
      }
      .brand .title .fx {
        font-size: 20px;
        color: #FF6821;
        margin-left: 4px;
      }
      .brand .edition {
        font-size: 24px;
        margin-left: 4px;
      }
      .loader {
        width: 150px;
        height: 10px;
        border: 2px solid #b2b2b2;
        border-radius: 7px;
        margin: 0 auto;
        padding: 2px 1px;
        overflow: hidden;
        font-size: 0;
      }
      :host(.dark) .loader {
        border-color: #4a4a4a;
      }
      .bar {
        width: 9px;
        height: 100%;
        margin-right: 2px;
        display: inline-block;
        background: linear-gradient(to bottom, #2838c7 0%,#5979ef 17%,#869ef3 32%,#869ef3 45%,#5979ef 59%,#2838c7 100%);
        animation: xp-loader 1.5s infinite linear;
      }
      @keyframes xp-loader {
        0% { transform: translateX(-30px); }
        100% { transform: translateX(150px); }
      }
      
      .footer {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 12px;
        opacity: 0.6;
      }
    `;

    const container = document.createElement("div");
    container.className = "container";
    container.innerHTML = `
      <div class="brand">
        <p class="company">DDDX<span class="copyright">©</span></p>
        <p class="title">Intelligent<span class="fx">fx</span></p>
        <p class="edition">Studio Edition</p>
      </div>
      <div class="loader">
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
      </div>
      <div class="footer">A shout-out to <b>Windows XP</b></div>
    `;

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(container);
  }
}

export function mountLoading() {
  applyBootTheme();

  if (!customElements.get(LOADING_TAG)) {
    customElements.define(LOADING_TAG, DddxLoading);
  }
  const loading = document.createElement(LOADING_TAG) as HTMLElement;
  loading.id = LOADING_TAG;
  document.body.appendChild(loading);
}

export function unmountLoading() {
  const loading = document.getElementById(LOADING_TAG);
  if (loading) {
    loading.remove();
  }
}

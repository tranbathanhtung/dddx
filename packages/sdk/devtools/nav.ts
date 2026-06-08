import type { Remote } from "comlink";
import type { ParentApi } from "./types";

export const nav = {
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  reload: () => window.location.reload(),
  go: (url: string) => {
    window.location.href = url;
  },
};

export function watchUrl(getParent: () => Remote<ParentApi> | null) {
  let latest = window.location.href;

  const emit = () => {
    const url = window.location.href;
    if (url === latest) return;
    latest = url;
    void getParent()?.onUrlChange(url);
  };

  window.addEventListener("popstate", emit);
  window.addEventListener("hashchange", emit);
  window.addEventListener("pageshow", emit);

  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);

  history.pushState = (...args) => {
    push(...args);
    emit();
  };

  history.replaceState = (...args) => {
    replace(...args);
    emit();
  };

  return emit;
}

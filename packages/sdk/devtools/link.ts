import * as Comlink from "comlink";
import type { Remote } from "comlink";
import type { ChildApi } from "./api";
import type { ParentApi } from "./types";

export function bindLink(api: ChildApi, onLink?: () => void) {
  let parent: Remote<ParentApi> | null = null;
  const getParent = () => parent;

  const onMsg = (event: MessageEvent) => {
    if (event.data.type !== "devtools.parent.initialized" || event.ports.length < 2) {
      return;
    }

    const [toChild, toParent] = event.ports;
    if (!toChild || !toParent) {
      console.error("Invalid ports from parent");
      return;
    }

    parent = Comlink.wrap<ParentApi>(toChild);
    Comlink.expose(api, toParent);
    onLink?.();
    window.parent.postMessage({ type: "devtools.comlink.ready" }, "*");
  };

  window.addEventListener("message", onMsg);

  return { getParent };
}

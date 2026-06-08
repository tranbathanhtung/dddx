import { createRoot } from "react-dom/client";
import type { Remote } from "comlink";
import { markDevtoolsRoot } from "@/lib/capture-screenshot";
import { AnnotateView } from "./annotate/view";
import type { ParentApi } from "./types";

export function mount(getParent: () => Remote<ParentApi> | null) {
  const root = document.createElement("div");
  markDevtoolsRoot(root);
  document.body.appendChild(root);

  createRoot(root).render(
    <AnnotateView
      getParent={getParent}
      onReady={() => {
        window.parent.postMessage({ type: "devtools.initialized" }, "*");
      }}
    />,
  );
}

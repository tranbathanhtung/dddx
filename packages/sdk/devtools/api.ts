import { captureViewportScreenshot } from "@/lib/capture-screenshot";
import { annotateBridge } from "./annotate/bridge";
import { click, dispose, inject } from "./extensions/run";
import { nav } from "./nav";

export function createApi() {
  return {
    goBack: nav.back,
    goForward: nav.forward,
    refresh: nav.reload,
    navigateTo: nav.go,
    setAnnotationActive: (active: boolean) => {
      annotateBridge.current?.setActive(active);
    },
    toggleAnnotation: () => {
      annotateBridge.current?.toggle();
    },
    getAnnotationActive: () => annotateBridge.current?.isActive() ?? false,
    captureScreenshot: () => captureViewportScreenshot(),
    injectExtension: inject,
    disposeExtension: dispose,
    clickExtension: click,
  };
}

export type ChildApi = ReturnType<typeof createApi>;

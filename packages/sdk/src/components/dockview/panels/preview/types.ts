import type { PromptContext } from "@/components/prompt-context-provider";
import type { AnnotationSourceContext } from "@/lib/context";

export type Status = "loading" | "error" | "ready";

export type ParentApi = {
  insertContextInput: (context: PromptContext) => void;
  onUrlChange: (url: string) => void;
  onAnnotationActiveChange: (active: boolean) => void;
  getAnnotationContext: () => Promise<AnnotationSourceContext>;
};

export type ChildApi = {
  goBack: () => void;
  goForward: () => void;
  refresh: () => void;
  navigateTo: (url: string) => void;
  setAnnotationActive: (active: boolean) => void;
  toggleAnnotation: () => void;
  getAnnotationActive: () => boolean;
  captureScreenshot: () => Promise<string>;
  injectExtension: (id: string, source: string) => void;
  disposeExtension: (id: string) => void;
  clickExtension: (id: string) => void;
};

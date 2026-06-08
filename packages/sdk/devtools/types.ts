import type { PromptContext } from "@/components/prompt-context-provider";
import type { AnnotationSourceContext } from "@/lib/context";

export type ParentApi = {
  insertContextInput: (context: PromptContext) => void;
  onUrlChange: (url: string) => void;
  onAnnotationActiveChange: (active: boolean) => void;
  getAnnotationContext: () => Promise<AnnotationSourceContext>;
};

export type AnnotateBridge = {
  setActive: (active: boolean) => void;
  toggle: () => void;
  isActive: () => boolean;
};

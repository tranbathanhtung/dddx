import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  AttachedImage,
  AttachedFile,
} from "@/components/agent-elements/input-bar";
import {
  contextKind,
  type ContextKind,
  type PromptContextPart,
} from "@/lib/context";

export type { ContextKind };

export type PromptContext = AttachedImage | AttachedFile | PromptContextPart;

interface PromptContextValue {
  customContexts: PromptContext[];
  setCustomContexts: React.Dispatch<React.SetStateAction<PromptContext[]>>;
  insertContextInput: (context: PromptContext) => void;
}

const PromptContextContext = createContext<PromptContextValue | null>(null);

export function PromptContextProvider({ children }: { children: ReactNode }) {
  const [customContexts, setCustomContexts] = useState<PromptContext[]>([]);

  const insertContextInput = useCallback((context: PromptContext) => {
    if (!("id" in context) || !context.id) return;

    setCustomContexts((prev) => {
      if (prev.some((item) => "id" in item && item.id === context.id)) {
        return prev;
      }

      if ("filename" in context && typeof context.filename === "string") {
        return [...prev, context];
      }

      if ("value" in context && "name" in context) {
        const part: PromptContextPart = {
          id: context.id,
          name: context.name,
          value: context.value,
          kind: contextKind(context),
        };
        return [...prev, part];
      }

      return prev;
    });
  }, []);

  const value = useMemo(
    () => ({
      customContexts,
      setCustomContexts,
      insertContextInput,
    }),
    [customContexts],
  );

  return (
    <PromptContextContext.Provider value={value}>
      {children}
    </PromptContextContext.Provider>
  );
}

export function usePromptContext() {
  const context = useContext(PromptContextContext);
  if (!context) {
    throw new Error(
      "usePromptContext must be used within PromptContextProvider",
    );
  }
  return context;
}

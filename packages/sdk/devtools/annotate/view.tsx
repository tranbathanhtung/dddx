import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Agentation } from "agentation";
import type { Remote } from "comlink";
import { annotationContextName, formatAnnotationValue } from "@/lib/context";
import type { ParentApi } from "../types";
import { annotateBridge } from "./bridge";

export function AnnotateView({
  getParent,
  onReady,
}: {
  getParent: () => Remote<ParentApi> | null;
  onReady: () => void;
}) {
  const [active, setActive] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  const setActiveSafe = useCallback(
    (next: boolean) => {
      setActive(next);
      void getParent()?.onAnnotationActiveChange(next);
    },
    [getParent],
  );

  annotateBridge.current = {
    setActive: setActiveSafe,
    toggle: () => setActiveSafe(!activeRef.current),
    isActive: () => activeRef.current,
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !activeRef.current) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setActiveSafe(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActiveSafe]);

  useLayoutEffect(() => {
    onReady();
  }, [onReady]);

  return (
    <Agentation
      hideToolbar
      active={active}
      onActiveChange={setActiveSafe}
      submitOnAdd
      copyToClipboard={false}
      onCopy={(markdown) => {
        void (async () => {
          const parent = getParent();
          if (!parent) return;
          const ctx = await parent.getAnnotationContext();
          void parent.insertContextInput({
            id: crypto.randomUUID(),
            kind: "annotation",
            name: annotationContextName(ctx),
            value: formatAnnotationValue(markdown, ctx),
          });
        })();
      }}
    />
  );
}

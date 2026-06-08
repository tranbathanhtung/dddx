import * as Comlink from "comlink";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Remote } from "comlink";
import type { PromptContext } from "@/components/prompt-context-provider";
import type { AnnotationSourceContext } from "@/lib/context";
import { useLatest } from "@/hooks/use-latest";
import { replayActive } from "@/extensions";
import {
  registerBridge,
  unregisterBridge,
} from "./bridge-registry";
import type { ChildApi, ParentApi } from "./types";

export function useBridge({
  bridgeId,
  iframeRef,
  childRef,
  insertContext,
  getAnnotationContext,
  onUrl,
  onAnnotate,
}: {
  /** When set, this bridge can receive preview extension commands. */
  bridgeId?: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  childRef: React.MutableRefObject<Remote<ChildApi> | null>;
  insertContext: (ctx: PromptContext) => void;
  getAnnotationContext: () => AnnotationSourceContext;
  onUrl: (url: string) => void;
  onAnnotate: (active: boolean) => void;
}) {
  const channelsRef = useRef<{
    parentToChild: MessageChannel;
    childToParent: MessageChannel;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const onUrlRef = useLatest(onUrl);
  const getAnnotationContextRef = useLatest(getAnnotationContext);

  useLayoutEffect(() => {
    if (!bridgeId) return;
    registerBridge(bridgeId, () => childRef.current);
    return () => unregisterBridge(bridgeId);
  }, [bridgeId, childRef]);

  const closeChannels = useCallback(() => {
    const ch = channelsRef.current;
    if (!ch) return;
    ch.parentToChild.port1.close();
    ch.parentToChild.port2.close();
    ch.childToParent.port1.close();
    ch.childToParent.port2.close();
    channelsRef.current = null;
  }, []);

  const reset = useCallback(() => {
    if (childRef.current) {
      childRef.current[Comlink.releaseProxy]();
      childRef.current = null;
    }
    closeChannels();
    setReady(false);
  }, [childRef, closeChannels]);

  const syncAnnotate = useCallback(() => {
    void childRef.current?.getAnnotationActive().then(onAnnotate);
  }, [childRef, onAnnotate]);

  const init = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    closeChannels();

    const parentToChild = new MessageChannel();
    const childToParent = new MessageChannel();
    channelsRef.current = { parentToChild, childToParent };

    childRef.current = Comlink.wrap<ChildApi>(childToParent.port1);

    Comlink.expose(
      {
        insertContextInput: insertContext,
        onUrlChange: (url: string) => onUrlRef.current(url),
        onAnnotationActiveChange: onAnnotate,
        getAnnotationContext: async () => getAnnotationContextRef.current(),
      } satisfies ParentApi,
      parentToChild.port1,
    );

    setReady(true);
  }, [
    closeChannels,
    getAnnotationContextRef,
    insertContext,
    onAnnotate,
    onUrlRef,
    iframeRef,
    childRef,
  ]);

  const onMessage = useCallback(
    (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (event.data.type === "devtools.initialized") {
        init();
        iframeRef.current!.contentWindow!.postMessage(
          { type: "devtools.parent.initialized" },
          "*",
          [
            channelsRef.current!.parentToChild.port2,
            channelsRef.current!.childToParent.port2,
          ],
        );
        return;
      }

      if (event.data.type === "devtools.comlink.ready") {
        if (bridgeId) void replayActive(childRef.current);
        syncAnnotate();
      }
    },
    [bridgeId, childRef, init, iframeRef, syncAnnotate],
  );

  useLayoutEffect(() => {
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onMessage]);

  return { ready, reset, syncAnnotate };
}

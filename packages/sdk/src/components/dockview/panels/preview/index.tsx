import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Remote } from "comlink";
import { usePromptContext } from "@/components/prompt-context-provider";
import { useLatest } from "@/hooks/use-latest";
import { useBridge } from "./bridge";
import { Frame } from "./frame";
import { shotName } from "./shot";
import { Toolbar } from "./toolbar";
import { sameUrl, normUrl } from "./url";
import { usePreviewTargets } from "@/hooks/use-preview-targets";
import { LocalTargets } from "./local-targets";
import type { ChildApi, Status } from "./types";

export type PreviewStatus = Status;

export const PreviewPanel = memo(
  forwardRef<
    HTMLIFrameElement,
    {
      currentUrl?: string;
      targetId?: string;
      pickTarget?: boolean;
      bridgeId?: string;
      onTargetSelect?: (target: {
        id: string;
        label: string;
        url: string;
      }) => void;
    }
  >(function PreviewPanel(
    { currentUrl, targetId, pickTarget, bridgeId, onTargetSelect },
    _ref,
  ) {
    const { insertContextInput } = usePromptContext();
    const { targets, defaultTargetId } = usePreviewTargets();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const childRef = useRef<Remote<ChildApi> | null>(null);

    const [pageUrl, setPageUrl] = useState(currentUrl ?? "");
    const [addr, setAddr] = useState(currentUrl ?? "");
    const [activeTargetId, setActiveTargetId] = useState<string | null>(
      targetId ?? null,
    );
    const [showPicker, setShowPicker] = useState(pickTarget ?? false);
    const [status, setStatus] = useState<Status>("loading");
    const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
    const [annotate, setAnnotate] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const [canBack, setCanBack] = useState(false);
    const [canForward, setCanForward] = useState(false);
    const latestUrl = useLatest(pageUrl);
    const latestAddr = useLatest(addr);
    const latestDevice = useLatest(device);

    const getAnnotationContext = useCallback(
      () => ({
        source: "app-preview" as const,
        url: latestAddr.current,
        device: latestDevice.current,
      }),
      [latestAddr, latestDevice],
    );

    useEffect(() => {
      if (targetId) {
        setActiveTargetId(targetId);
      }
    }, [targetId]);

    useEffect(() => {
      if (currentUrl) {
        setPageUrl(currentUrl);
        setAddr(currentUrl);
        setShowPicker(false);
      }
    }, [currentUrl]);

    useEffect(() => {
      if (currentUrl || pickTarget || targets.length === 0) return;

      const preferred =
        targets.find((target) => target.id === (targetId ?? defaultTargetId)) ??
        targets[0];
      if (!preferred) return;

      setActiveTargetId(preferred.id);
      setPageUrl((url) => url || preferred.url);
      setAddr((url) => url || preferred.url);
    }, [currentUrl, defaultTargetId, pickTarget, targetId, targets]);

    const { ready, reset } = useBridge({
      bridgeId,
      iframeRef,
      childRef,
      insertContext: insertContextInput,
      getAnnotationContext,
      onUrl: (url) => {
        setAddr(url);
        setPageUrl(url);
        setStatus("ready");
      },
      onAnnotate: setAnnotate,
    });

    const refresh = useCallback(() => {
      if (!iframeRef.current) return;
      setStatus("loading");
      const active = iframeRef.current.src;
      iframeRef.current.src = "about:blank";
      setTimeout(() => {
        iframeRef.current!.src = latestUrl.current || active;
        reset();
        setAnnotate(false);
      }, 10);
    }, [latestUrl, reset]);

    const syncNavState = useCallback(() => {
      setCanBack(historyIndexRef.current > 0);
      setCanForward(
        historyIndexRef.current < historyRef.current.length - 1,
      );
    }, []);

    // Track navigation history in the parent. The iframe's own
    // `window.history` reflects the whole tab's joint session history, so
    // calling `history.back()`/`forward()` inside the iframe cannot reliably
    // navigate just the preview. We record every visited URL here and drive
    // the iframe explicitly instead.
    const recordVisit = useCallback(
      (url: string) => {
        const next = normUrl(url) ?? url;
        const current = historyRef.current[historyIndexRef.current];
        if (current && sameUrl(current, next)) return;
        historyRef.current = historyRef.current.slice(
          0,
          historyIndexRef.current + 1,
        );
        historyRef.current.push(next);
        historyIndexRef.current = historyRef.current.length - 1;
        syncNavState();
      },
      [syncNavState],
    );

    const loadUrl = useCallback(
      (url: string) => {
        setStatus("loading");
        setAddr(url);
        setPageUrl(url);
        setShowPicker(false);
        reset();
        setAnnotate(false);
        if (iframeRef.current) {
          iframeRef.current.src = url;
        }
      },
      [reset],
    );

    const go = useCallback(
      (url: string) => {
        const next = normUrl(url);
        if (!next || sameUrl(next, addr)) return;
        loadUrl(next);
      },
      [addr, loadUrl],
    );

    const back = useCallback(() => {
      if (historyIndexRef.current <= 0) return;
      historyIndexRef.current -= 1;
      syncNavState();
      loadUrl(historyRef.current[historyIndexRef.current]!);
    }, [loadUrl, syncNavState]);

    const forward = useCallback(() => {
      if (historyIndexRef.current >= historyRef.current.length - 1) return;
      historyIndexRef.current += 1;
      syncNavState();
      loadUrl(historyRef.current[historyIndexRef.current]!);
    }, [loadUrl, syncNavState]);

    // Record every URL the preview lands on. `recordVisit` dedupes against the
    // current entry, so back/forward navigations (which set `pageUrl` to an
    // existing entry) are no-ops here and never corrupt the stack.
    useEffect(() => {
      if (pageUrl) recordVisit(pageUrl);
    }, [pageUrl, recordVisit]);

    const selectTarget = useCallback(
      (target: { id: string; url: string; label: string }) => {
        setActiveTargetId(target.id);
        onTargetSelect?.(target);
        go(target.url);
      },
      [go, onTargetSelect],
    );

    const shot = useCallback(async () => {
      if (!childRef.current || capturing) return;
      setCapturing(true);
      try {
        const dataUrl = await childRef.current.captureScreenshot();
        const name = shotName(addr);
        const base64 = dataUrl.split(",")[1];
        insertContextInput({
          id: crypto.randomUUID(),
          filename: name,
          url: dataUrl,
          size: base64 ? Math.floor((base64.length * 3) / 4) : undefined,
        });
      } catch (error) {
        console.error("Preview screenshot failed:", error);
      } finally {
        setCapturing(false);
      }
    }, [addr, capturing, insertContextInput]);

    useEffect(() => {
      if (!annotate) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        const t = e.target;
        if (
          t instanceof HTMLElement &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        if (childRef.current) {
          void childRef.current.setAnnotationActive(false);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [annotate]);

    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <Toolbar
          url={addr}
          status={status}
          device={device}
          annotate={annotate}
          devReady={ready}
          capturing={capturing}
          canBack={canBack}
          canForward={canForward}
          onBack={back}
          onFwd={forward}
          onRefresh={refresh}
          onGo={go}
          onOpen={() => {
            if (addr) window.open(addr, "_blank", "noopener,noreferrer");
          }}
          onShowLocal={
            targets.length > 0
              ? () => setShowPicker((value) => !value)
              : undefined
          }
          onAnnotate={() => void childRef.current?.toggleAnnotation()}
          onShot={() => void shot()}
          onDevice={() =>
            setDevice((d) => (d === "desktop" ? "mobile" : "desktop"))
          }
        />
        {showPicker && targets.length > 0 ? (
          <LocalTargets
            targets={targets}
            activeId={activeTargetId}
            onSelect={selectTarget}
          />
        ) : pageUrl ? (
          <Frame
            ref={iframeRef}
            url={pageUrl}
            device={device}
            status={status}
            onLoad={() => {
              setStatus("ready");
            }}
            onError={() => {
              setStatus("error");
              reset();
            }}
          />
        ) : null}
      </div>
    );
  }),
);

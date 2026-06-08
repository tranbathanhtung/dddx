"use client";

import { useEffect, useRef, useState } from "react";
import { IconEye } from "@tabler/icons-react";

import {
  Markdown,
  stripMarkdownFrontmatter,
} from "@/components/agent-elements/markdown";
import { usePluginRowScrollRoot } from "@/components/plugins/plugin-gallery-context";
import { cn } from "@/lib/utils";

export type PreviewMediaType = "html" | "image" | "markdown" | "video";

const MARKDOWN_PREVIEW_W = 420;

const MEASURE_W = 1920;
const MEASURE_H = 1080;

function measurePreview(doc: Document): number | null {
  const root = doc.documentElement;
  const body = doc.body;

  const w = Math.max(
    root.scrollWidth,
    root.clientWidth,
    body?.scrollWidth ?? 0,
    body?.clientWidth ?? 0,
  );

  return w > 0 ? w : null;
}

function useLazyPreviewLoad(enabled: boolean, root: HTMLElement | null) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setShouldLoad(true);
      return;
    }

    const el = hostRef.current;
    if (!el) return;

    let unloadTimer: ReturnType<typeof setTimeout> | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          if (unloadTimer) clearTimeout(unloadTimer);
          setShouldLoad(true);
          return;
        }

        unloadTimer = setTimeout(() => setShouldLoad(false), 400);
      },
      {
        root,
        rootMargin: "80px",
        threshold: 0,
      },
    );

    observer.observe(el);
    return () => {
      if (unloadTimer) clearTimeout(unloadTimer);
      observer.disconnect();
    };
  }, [enabled, root]);

  return { hostRef, shouldLoad };
}

export function PreviewIframe({
  src,
  title,
  lazy = false,
}: {
  src: string;
  title: string;
  lazy?: boolean;
}) {
  const rowScrollRoot = usePluginRowScrollRoot();
  const { hostRef, shouldLoad } = useLazyPreviewLoad(lazy, rowScrollRoot);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(MEASURE_W);
  const [visible, setVisible] = useState(false);
  const [scale, setScale] = useState(0.1);

  const contentW = width;

  useEffect(() => {
    if (!shouldLoad) {
      setVisible(false);
      return;
    }

    const host = hostRef.current;
    if (!host) return;

    const fit = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setScale(Math.max(width / contentW, height / MEASURE_H));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, [contentW, shouldLoad, hostRef]);

  const measure = () => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;

    requestAnimationFrame(() => {
      const measured = doc ? measurePreview(doc) : null;
      setWidth(measured && measured > 0 ? measured : MEASURE_W);
      setVisible(true);
    });
  };

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden bg-background">
      {shouldLoad ? (
        <iframe
          ref={iframeRef}
          src={src}
          title={title}
          tabIndex={-1}
          onLoad={measure}
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 border-0 transition-opacity duration-200",
            !visible && "opacity-0",
          )}
          style={{
            width: contentW,
            height: MEASURE_H,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        />
      ) : null}
    </div>
  );
}

function PreviewMarkdown({
  src,
  title,
  lazy = false,
}: {
  src: string;
  title: string;
  lazy?: boolean;
}) {
  const rowScrollRoot = usePluginRowScrollRoot();
  const { hostRef, shouldLoad } = useLazyPreviewLoad(lazy, rowScrollRoot);
  const [content, setContent] = useState<string | null>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    if (!shouldLoad) {
      setContent(null);
      return;
    }

    let cancelled = false;
    fetch(src)
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((text) => {
        if (!cancelled) setContent(stripMarkdownFrontmatter(text));
      })
      .catch(() => {
        if (!cancelled) setContent(null);
      });

    return () => {
      cancelled = true;
    };
  }, [src, shouldLoad]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const fit = () => {
      const { width } = host.getBoundingClientRect();
      if (width <= 0) return;
      setScale(width / MARKDOWN_PREVIEW_W);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, [hostRef, shouldLoad]);

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden bg-background">
      {content ? (
        <div
          className="pointer-events-none absolute top-0 left-0 origin-top-left p-3 select-none"
          style={{
            width: MARKDOWN_PREVIEW_W,
            transform: `scale(${scale})`,
          }}
        >
          <Markdown
            content={content}
            className="[&_.an-md-h1]:mt-0 [&_.an-md-h1]:text-sm [&_.an-md-h2]:text-xs [&_.an-md-h3]:text-[11px] [&_.an-md-p]:text-[10px] [&_.an-md-p]:leading-snug [&_li]:text-[10px]"
          />
        </div>
      ) : shouldLoad ? (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      ) : null}
    </div>
  );
}

export function TemplatePreview({
  title,
  preview,
  tone,
  onPreview,
  aspectRatio = "16/10",
  groupName = "plugin-card",
  compactControls = false,
  className,
  lazyPreview,
}: {
  title: string;
  preview?: { type: PreviewMediaType; url: string };
  tone?: string;
  onPreview?: () => void;
  aspectRatio?: "16/10" | "1.76";
  groupName?: "plugin-card" | "template-card";
  compactControls?: boolean;
  className?: string;
  lazyPreview?: boolean;
}) {
  const lazyHtml =
    lazyPreview ?? (groupName === "plugin-card" && preview?.type === "html");
  const lazyMarkdown =
    lazyPreview ?? (groupName === "plugin-card" && preview?.type === "markdown");

  const showPreviewOverlay =
    groupName === "template-card"
      ? "group-hover/template-card:opacity-100"
      : "group-hover/plugin-card:opacity-100";
  const showPreviewButton =
    groupName === "template-card"
      ? "group-hover/template-card:translate-y-0"
      : "group-hover/plugin-card:translate-y-0";

  return (
    <div
      className={cn(
        "relative overflow-hidden border rounded-none bg-muted",
        aspectRatio === "1.76" ? "aspect-[1.76]" : "aspect-[16/10]",
        className,
      )}
    >
      {preview?.type === "image" ? (
        <img
          src={preview.url}
          alt={title}
          loading={lazyHtml ? "lazy" : undefined}
          className={cn(
            "size-full object-cover",
            groupName === "plugin-card" &&
              "transition-transform duration-300 group-hover/plugin-card:scale-[1.02]",
          )}
        />
      ) : preview?.type === "video" ? (
        <video
          src={preview.url}
          className={cn(
            "size-full object-cover",
            groupName === "plugin-card" &&
              "transition-transform duration-300 group-hover/plugin-card:scale-[1.02]",
          )}
          muted
          playsInline
          loop
          autoPlay
          preload="metadata"
        />
      ) : preview?.type === "html" ? (
        <PreviewIframe src={preview.url} title={title} lazy={lazyHtml} />
      ) : preview?.type === "markdown" ? (
        <PreviewMarkdown src={preview.url} title={title} lazy={lazyMarkdown} />
      ) : (
        <div
          className={cn(
            "absolute inset-0 bg-linear-to-br",
            tone ?? "from-muted via-background to-muted",
          )}
        />
      )}
      {preview && onPreview ? (
        <div
          className={cn(
            "absolute inset-0 opacity-0 transition-opacity",
            showPreviewOverlay,
          )}
        >
          <button
            type="button"
            aria-label={`Preview ${title}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onPreview();
            }}
            className={cn(
              "absolute flex items-center justify-center text-white backdrop-blur-sm",
              compactControls
                ? "top-2 right-2 size-5 -translate-y-1/2 rounded bg-foreground/20 backdrop-blur-lg transition-transform duration-150 ease-in-out"
                : "top-2.5 right-2.5 size-7 rounded-md bg-black/50",
              showPreviewButton,
            )}
          >
            <IconEye
              className={compactControls ? "size-3.5" : "size-4"}
              stroke={compactControls ? undefined : 1.75}
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}

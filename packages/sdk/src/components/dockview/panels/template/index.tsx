"use client";

import { memo, useEffect, useState } from "react";
import { IconFileDescription } from "@tabler/icons-react";

import {
  Markdown,
  stripMarkdownFrontmatter,
} from "@/components/agent-elements/markdown";
import type { PreviewMediaType } from "@/components/template-preview";

export type TemplatePreviewParams = {
  url?: string;
  title?: string;
  previewType?: PreviewMediaType;
};

function resolvePreviewType(
  url: string | undefined,
  previewType: PreviewMediaType | undefined,
): PreviewMediaType {
  if (previewType) return previewType;
  if (url?.includes("/skills/")) return "markdown";
  return "html";
}

export const TemplatePreviewPanel = memo(function TemplatePreviewPanel({
  url,
  title,
  previewType,
}: TemplatePreviewParams) {
  const resolvedType = resolvePreviewType(url, previewType);
  const [markdown, setMarkdown] = useState<string | null>(null);

  useEffect(() => {
    if (!url || resolvedType !== "markdown") {
      setMarkdown(null);
      return;
    }

    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((text) => {
        if (!cancelled) setMarkdown(stripMarkdownFrontmatter(text));
      })
      .catch(() => {
        if (!cancelled) setMarkdown(null);
      });

    return () => {
      cancelled = true;
    };
  }, [url, resolvedType]);

  if (!url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <IconFileDescription className="size-8" stroke={1.4} />
        <span>Select a template to preview</span>
      </div>
    );
  }

  if (resolvedType === "markdown") {
    return (
      <div className="h-full overflow-y-auto bg-background p-6">
        {markdown ? (
          <Markdown content={markdown} className="mx-auto max-w-3xl" />
        ) : (
          <div className="mx-auto max-w-3xl animate-pulse space-y-3">
            <div className="h-6 w-2/5 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-11/12 rounded bg-muted" />
          </div>
        )}
      </div>
    );
  }

  if (resolvedType === "image") {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6">
        <img
          src={url}
          alt={title ?? "Preview"}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (resolvedType === "video") {
    return (
      <video
        key={url}
        src={url}
        className="h-full w-full bg-background object-contain"
        controls
        autoPlay
        playsInline
        loop
      />
    );
  }

  return (
    <iframe
      key={url}
      src={url}
      title={title ?? "Template"}
      className="h-full w-full border-0 bg-background"
    />
  );
});

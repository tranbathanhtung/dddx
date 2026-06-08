"use client";

import { cn } from "@/lib/utils";

import { PluginPreview } from "./plugin-preview";

export function PluginMarketplaceCard({
  title,
  label,
  description,
  pluginName,
  author,
  preview,
  tone,
  disabled,
  onClick,
  onPreview,
}: {
  title: string;
  label?: string;
  description?: string;
  pluginName?: string;
  author?: { name: string; url?: string };
  preview?: { type: "html" | "image" | "markdown" | "video"; url: string };
  tone?: string;
  disabled?: boolean;
  onClick: () => void;
  onPreview?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group/plugin-card flex h-full w-full min-w-0 flex-col text-left disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <PluginPreview
        title={title}
        preview={preview}
        tone={tone}
        onPreview={onPreview}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-1 pt-2.5">
        <div className="space-y-0.5">
          {label ? (
            <div className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
          ) : null}
          <div className="truncate text-sm font-medium tracking-tight">
            {title}
          </div>
        </div>

        {description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}

        {(pluginName || author?.name) && (
          <div className="mt-auto flex min-w-0 items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            {pluginName ? (
              <span className="truncate font-medium text-foreground/70">
                {pluginName}
              </span>
            ) : null}
            {pluginName && author?.name ? (
              <span className="shrink-0 opacity-50">·</span>
            ) : null}
            {author?.name ? (
              author.url ? (
                <span
                  className="truncate"
                  onClick={(event) => event.stopPropagation()}
                >
                  {author.name}
                </span>
              ) : (
                <span className="truncate">{author.name}</span>
              )
            ) : null}
          </div>
        )}
      </div>
    </button>
  );
}

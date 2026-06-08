import { useState } from "react";
import {
  IconDeviceDesktop,
  IconHighlight,
  IconLayout,
  IconPalette,
  IconX as X,
} from "@tabler/icons-react";
import type { AttachedCustomContext, ContextKind } from "../input-bar";
import { PreviewIframe } from "@/components/template-preview";
import {
  annotationContextName,
  contextKind,
  contextPreviewIsHtml,
  contextPreviewUrl,
  parseAnnotationSourceContext,
  parseContextValue,
} from "@/lib/context";
import { cn } from "../utils/cn";

const thumbClass =
  "size-8 shrink-0 overflow-hidden rounded-[calc(var(--an-input-border-radius)-var(--an-context-padding)-2px)]";

function truncate(text: string, maxLength = 48) {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength).trimEnd()}…`;
}

function contextSubtitle(
  context: AttachedCustomContext,
  kind: ContextKind,
): string | null {
  if (kind === "annotation") {
    const ctx = parseAnnotationSourceContext(context.value);
    if (ctx.source) return annotationContextName(ctx);
    return truncate(context.value);
  }

  if (kind === "template" && context.id.startsWith("template:")) {
    const category = context.id.slice("template:".length).split("/")[0];
    return category ? category.replace(/-/g, " ") : null;
  }

  return null;
}

const kindMeta: Record<
  ContextKind,
  { accent: string; icon: typeof IconPalette }
> = {
  theme: { accent: "text-violet-600 dark:text-violet-400", icon: IconPalette },
  template: { accent: "text-sky-600 dark:text-sky-400", icon: IconLayout },
  skill: {
    accent: "text-violet-600 dark:text-violet-400",
    icon: IconHighlight,
  },
  annotation: {
    accent: "text-amber-600 dark:text-amber-400",
    icon: IconHighlight,
  },
  frame: {
    accent: "text-blue-600 dark:text-blue-400",
    icon: IconDeviceDesktop,
  },
};

function hasPreviewThumb(kind: ContextKind, previewUrl?: string) {
  return (
    !!previewUrl &&
    (kind === "template" || kind === "theme" || kind === "frame")
  );
}

function ContextThumbnail({
  context,
  kind,
}: {
  context: AttachedCustomContext;
  kind: ContextKind;
}) {
  const { icon: Icon, accent } = kindMeta[kind];
  const previewUrl = contextPreviewUrl(context, kind);

  if (hasPreviewThumb(kind, previewUrl)) {
    const useIframe = contextPreviewIsHtml(previewUrl!, kind);

    return (
      <div
        className={cn(
          thumbClass,
          "border border-border bg-muted size-8 relative",
        )}
      >
        {useIframe ? (
          <PreviewIframe src={previewUrl!} title={context.name} />
        ) : (
          <img
            src={previewUrl}
            alt=""
            className="size-full object-cover pointer-events-none"
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        thumbClass,
        "flex items-center justify-center border border-border bg-muted",
      )}
    >
      <Icon className={cn("size-4", accent)} />
    </div>
  );
}

export type ContextAttachmentProps = {
  context: AttachedCustomContext;
  onRemove?: () => void;
  className?: string;
};

export function ContextAttachment({
  context,
  onRemove,
  className,
}: ContextAttachmentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const kind = contextKind(context);
  const subtitle = contextSubtitle(context, kind);

  return (
    <div
      className={cn(
        "relative flex size-10 justify-center items-center gap-2 rounded-[calc(var(--an-input-border-radius)-var(--an-context-padding))] bg-muted/50",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ContextThumbnail context={context} kind={kind} />

      <div className="min-w-0 flex-1 sr-only">
        <span
          className="block truncate text-sm font-medium text-foreground"
          title={context.name}
        >
          {context.name}
        </span>
        {subtitle ? (
          <span
            className="block truncate text-[10px] text-muted-foreground"
            title={
              kind === "annotation"
                ? context.value
                : parseContextValue(context.value).path
            }
          >
            {subtitle}
          </span>
        ) : null}
      </div>

      {onRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className={cn(
            "absolute -top-1.5 -right-1.5 z-10 flex size-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-[opacity,transform] duration-150 ease-out hover:text-foreground active:scale-[0.97]",
            isHovered ? "opacity-100" : "opacity-0",
          )}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

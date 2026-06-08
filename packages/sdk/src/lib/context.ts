import type { PluginListItem } from "@/components/plugins/types";

export type ContextKind =
  | "template"
  | "theme"
  | "skill"
  | "annotation"
  | "frame";

/** Where an inline annotation was captured in the studio. */
export type AnnotationSource = "app-preview" | "design-canvas";

export type AnnotationSourceContext = {
  source: AnnotationSource;
  /** Live preview URL (app preview bar or design frame iframe). */
  url?: string;
  /** Canvas frame label, e.g. `today`. */
  frame?: string;
  /** File within the design workspace, e.g. `today.html`. */
  file?: string;
  /** Design workspace slug, e.g. `demo`. */
  workspace?: string;
  /** Repo-relative design file path, e.g. `.dddx/designs/demo/today.html`. */
  path?: string;
  device?: "desktop" | "mobile";
};

export function designFilePath(workspace: string, file: string): string {
  return `.dddx/designs/${workspace}/${file}`;
}

export function formatAnnotationValue(
  markdown: string,
  ctx: AnnotationSourceContext,
): string {
  const meta: string[] = [`source: ${ctx.source}`];
  if (ctx.url) meta.push(`url: ${ctx.url}`);
  if (ctx.frame) meta.push(`frame: ${ctx.frame}`);
  if (ctx.file) meta.push(`file: ${ctx.file}`);
  if (ctx.workspace) meta.push(`workspace: ${ctx.workspace}`);
  if (ctx.path) meta.push(`path: ${ctx.path}`);
  if (ctx.device) meta.push(`device: ${ctx.device}`);
  return `${meta.join("\n")}\n\n${markdown.trim()}`;
}

export function annotationContextName(
  ctx: Partial<AnnotationSourceContext>,
): string {
  if (ctx.source === "design-canvas") {
    const label = ctx.frame ?? ctx.file ?? "frame";
    return `Frame · ${label}`;
  }
  if (ctx.source === "app-preview") return "App preview";
  return "Annotation";
}

/** Prompt attachment chip payload. */
export type PromptContextPart = {
  id: string;
  name: string;
  value: string;
  kind?: ContextKind;
};

const META_LINE = /^([a-z][a-z0-9_-]*):\s*(.+)$/i;

export function parseAnnotationSourceContext(
  value: string,
): Partial<AnnotationSourceContext> {
  const meta: Record<string, string> = {};
  for (const line of value.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(META_LINE);
    if (match) {
      meta[match[1]!.toLowerCase()] = match[2]!.trim();
      continue;
    }
    break;
  }

  const source = meta.source;
  return {
    ...(source === "app-preview" || source === "design-canvas"
      ? { source }
      : {}),
    url: meta.url,
    frame: meta.frame,
    file: meta.file,
    workspace: meta.workspace,
    path: meta.path,
    ...(meta.device === "desktop" || meta.device === "mobile"
      ? { device: meta.device }
      : {}),
  };
}

export function annotationBody(value: string): string {
  const lines = value.split("\n");
  let i = 0;
  for (; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (!trimmed) {
      i++;
      break;
    }
    if (!trimmed.match(META_LINE)) break;
  }
  while (i < lines.length && !lines[i]!.trim()) i++;
  return lines.slice(i).join("\n").trim();
}

export function contextKind(
  part: Pick<PromptContextPart, "id" | "kind">,
): ContextKind {
  if (part.kind) return part.kind;
  if (part.id.startsWith("theme:")) return "theme";
  if (part.id.startsWith("template:")) return "template";
  if (part.id.startsWith("skill:")) return "skill";
  if (part.id.startsWith("frame:")) return "frame";
  return "annotation";
}

/** Frames/plugins: path (+ optional preview). Annotations: free text. */
export function compactContextValue(args: {
  path: string;
  preview?: string;
}): string {
  const path = args.path.trim();
  const preview = args.preview?.trim();
  if (!path) return preview ?? "";
  if (!preview) return path;
  return `${path}\npreview: ${preview}`;
}

export function parseContextValue(value: string): {
  path: string;
  preview?: string;
} {
  const meta: Record<string, string> = {};
  const bodyLines: string[] = [];

  for (const line of value.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(META_LINE);
    if (match) {
      meta[match[1]!.toLowerCase()] = match[2]!.trim();
      continue;
    }
    bodyLines.push(line);
  }

  const body = bodyLines.join("\n").trim();
  const path = meta.path?.trim() || body.split("\n")[0]?.trim() || body;
  return {
    path,
    preview: meta.preview?.trim(),
  };
}

export function contextPreviewUrl(
  part: Pick<PromptContextPart, "value" | "id">,
  kind: ContextKind,
): string | undefined {
  const { preview, path } = parseContextValue(part.value);
  if (preview) return preview;
  if (kind === "frame" && /\.html?$/i.test(path)) return path;
  return undefined;
}

export function contextPreviewIsHtml(url: string, kind: ContextKind): boolean {
  if (kind === "frame") return !/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
  if (kind === "template" || kind === "theme") {
    return (
      /\.html?(?:\?|$)/i.test(url) ||
      !/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)
    );
  }
  return /\.html?(?:\?|$)/i.test(url);
}

export function contextSubtitle(value: string, maxLength = 48): string {
  const { path } = parseContextValue(value);
  const text = path.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

export function pluginItemId(id: string): string | undefined {
  const match = id.match(/^(?:template|theme|skill):(.+)$/);
  if (!match) return undefined;
  return match[1]!.split("/").pop() ?? match[1];
}

export function templateContext(item: PluginListItem): PromptContextPart {
  const category = item.category ?? "general";
  return {
    id: `template:${category}/${item.name}`,
    name: item.title,
    kind: "template",
    value: compactContextValue({
      path: item.source,
      preview: item.preview?.url,
    }),
  };
}

export function themeContext(item: PluginListItem): PromptContextPart {
  return {
    id: `theme:${item.name}`,
    name: item.title,
    kind: "theme",
    value: compactContextValue({
      path: item.source,
      preview: item.preview?.url,
    }),
  };
}

export function skillContext(item: PluginListItem): PromptContextPart {
  return {
    id: `skill:${item.name}`,
    name: item.title,
    kind: "skill",
    value: compactContextValue({ path: item.source }),
  };
}

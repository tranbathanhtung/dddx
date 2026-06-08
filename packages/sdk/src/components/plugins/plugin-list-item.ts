import type { PluginSectionKind } from "./types";

export type PluginNavId = "all" | PluginSectionKind | `category:${string}`;

export function formatPluginCount(count: number) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}m`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

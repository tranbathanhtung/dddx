import { useMemo } from "react";

import type { PluginKind, PluginListItem } from "./types";

const PLUGIN_KIND_ORDER: Record<PluginKind, number> = {
  templates: 0,
  themes: 1,
  skills: 2,
};

/** templates → themes → skills, then title within each kind. */
export function comparePluginGalleryItems(
  a: Pick<PluginListItem, "kind" | "title">,
  b: Pick<PluginListItem, "kind" | "title">,
) {
  const kindDiff = PLUGIN_KIND_ORDER[a.kind] - PLUGIN_KIND_ORDER[b.kind];
  if (kindDiff !== 0) return kindDiff;
  return a.title.localeCompare(b.title);
}

export function titleFromId(id: string) {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function useTemplateSections(
  templates: readonly PluginListItem[],
) {
  return useMemo(() => {
    const map = new Map<
      string,
      { category: string; title: string; items: PluginListItem[] }
    >();

    for (const item of templates) {
      const category = item.category ?? "general";
      const section =
        map.get(category) ??
        ({
          category,
          title: titleFromId(category),
          items: [],
        } satisfies {
          category: string;
          title: string;
          items: PluginListItem[];
        });

      section.items.push(item);
      map.set(category, section);
    }

    return Array.from(map.values());
  }, [templates]);
}

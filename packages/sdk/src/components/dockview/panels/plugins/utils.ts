import Fuse from "fuse.js";

import type { PluginNavId } from "@/components/plugins/plugin-list-item";
import type { PluginSectionKind } from "@/components/plugins/types";
import type { useTemplateSections } from "@/components/plugins/utils";
import { titleFromId } from "@/components/plugins/utils";
import type { PluginTypeFilter } from "@/components/plugins/plugin-toolbar";

export function typeFilterFromProps(
  section?: PluginSectionKind,
): PluginTypeFilter {
  if (section === "themes") return "themes";
  if (section === "templates") return "templates";
  if (section === "skills") return "skills";
  return "all";
}

export function navFromProps(
  section?: PluginSectionKind,
  category?: string,
): PluginNavId {
  if (category) return `category:${category}`;
  if (section) return section;
  return "all";
}

export type PluginSearchRecord = {
  id: string;
  title: string;
  packName: string;
  packAuthor: string;
  category: string;
  description: string;
};

export function createPluginFuse(items: PluginSearchRecord[]) {
  return new Fuse(items, {
    keys: [
      { name: "title", weight: 0.4 },
      { name: "packName", weight: 0.25 },
      { name: "packAuthor", weight: 0.15 },
      { name: "category", weight: 0.1 },
      { name: "description", weight: 0.1 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
  });
}

export function searchPluginIds(
  fuse: Fuse<PluginSearchRecord>,
  query: string,
): Set<string> | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  return new Set(fuse.search(trimmed).map((result) => result.item.id));
}

export function breadcrumbs(
  activeNav: PluginNavId,
  templateSections: ReturnType<typeof useTemplateSections>,
) {
  const crumbs = ["Plugins"];
  if (activeNav === "all") crumbs.push("All");
  else if (activeNav === "templates") crumbs.push("Templates");
  else if (activeNav === "themes") crumbs.push("Themes");
  else if (activeNav.startsWith("category:")) {
    const categoryId = activeNav.slice("category:".length);
    const section = templateSections.find((s) => s.category === categoryId);
    crumbs.push("Templates");
    crumbs.push(section?.title ?? titleFromId(categoryId));
  }
  return crumbs;
}

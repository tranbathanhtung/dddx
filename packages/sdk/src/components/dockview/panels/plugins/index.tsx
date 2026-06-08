"use client";

import { useMemo, useState } from "react";
import { api } from "@/client";
import {
  PluginEmptyState,
  PluginLoadingState,
} from "@/components/plugins/plugin-states";
import {
  PluginGalleryHeader,
  type PluginTypeFilter,
} from "@/components/plugins/plugin-toolbar";
import { VirtualPluginGallery } from "@/components/plugins/plugin-virtual-gallery";
import type {
  PluginListItem,
  PluginListPack,
} from "@/components/plugins/types";
import { comparePluginGalleryItems } from "@/components/plugins/utils";
import {
  createPluginFuse,
  searchPluginIds,
  typeFilterFromProps,
} from "./utils";

export type PluginsPanelProps = {
  section?: PluginListItem["kind"];
  category?: string;
};

type GalleryItem = PluginListItem & { id: string };

function withGalleryIds(
  pack: PluginListPack,
  items: PluginListItem[],
): GalleryItem[] {
  return items.map((item) => ({
    ...item,
    plugin: pack.id,
    id: `${item.kind}:${pack.id}/${item.name}`,
  }));
}

function filterGalleryItem(
  item: GalleryItem,
  opts: {
    typeFilter: PluginTypeFilter;
    categoryFilter: string | null;
    searchMatchIds: Set<string> | null;
  },
) {
  if (opts.typeFilter === "templates" && item.kind !== "templates") return false;
  if (opts.typeFilter === "themes" && item.kind !== "themes") return false;
  if (opts.typeFilter === "skills" && item.kind !== "skills") return false;
  if (
    opts.categoryFilter &&
    (item.kind !== "templates" || item.category !== opts.categoryFilter)
  ) {
    return false;
  }
  if (opts.searchMatchIds && !opts.searchMatchIds.has(item.id)) return false;
  return true;
}

export function PluginsPanel({ section, category }: PluginsPanelProps) {
  const pluginsQuery = api.plugin.list.useQuery(undefined);

  const packs = pluginsQuery.data?.items ?? [];

  const galleryCount = useMemo(
    () => packs.reduce((n, pack) => n + pack.items.length, 0),
    [packs],
  );

  const [typeFilter, setTypeFilter] = useState<PluginTypeFilter>(() =>
    typeFilterFromProps(section),
  );
  const [categoryFilter, setCategoryFilter] = useState<string | null>(
    () => category ?? null,
  );
  const [search, setSearch] = useState("");

  const handleTypeFilterChange = (next: PluginTypeFilter) => {
    setTypeFilter(next);
    setCategoryFilter(null);
  };

  const searchRecords = useMemo(
    () =>
      packs.flatMap((pack) =>
        withGalleryIds(pack, pack.items).map((item) => ({
          id: item.id,
          title: item.title,
          packName: pack.name,
          packAuthor: pack.author?.name ?? "",
          category: item.category ?? "",
          description: pack.description ?? "",
        })),
      ),
    [packs],
  );

  const fuse = useMemo(() => createPluginFuse(searchRecords), [searchRecords]);

  const searchMatchIds = useMemo(
    () => searchPluginIds(fuse, search),
    [fuse, search],
  );

  const sections = useMemo(() => {
    const filterOpts = { typeFilter, categoryFilter, searchMatchIds };

    return packs
      .map((pack) => {
        const items = withGalleryIds(pack, pack.items)
          .filter((item) => filterGalleryItem(item, filterOpts))
          .sort(comparePluginGalleryItems);

        return { pack, items };
      })
      .filter((section) => section.items.length > 0)
      .sort((a, b) => a.pack.name.localeCompare(b.pack.name));
  }, [packs, typeFilter, categoryFilter, searchMatchIds]);

  const loading = pluginsQuery.isLoading;
  const hasPlugins = galleryCount > 0;

  if (!loading && !hasPlugins) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-background">
        <PluginEmptyState />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PluginGalleryHeader
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={handleTypeFilterChange}
      />
      {loading ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <PluginLoadingState />
        </div>
      ) : sections.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <PluginEmptyState />
        </div>
      ) : (
        <VirtualPluginGallery sections={sections} />
      )}
    </div>
  );
}

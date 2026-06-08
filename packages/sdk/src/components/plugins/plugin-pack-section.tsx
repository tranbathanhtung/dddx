"use client";

import type { ReactNode } from "react";

import { titleFromId } from "./utils";

export function PluginPackSectionHeader({
  title,
  description,
  viewAll,
}: {
  title: string;
  description?: string;
  viewAll?: {
    expanded: boolean;
    onToggle: () => void;
  };
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-0.5">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {viewAll ? (
        <button
          type="button"
          onClick={viewAll.onToggle}
          className="mt-0.5 shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {viewAll.expanded ? "Show less" : "View all"}
        </button>
      ) : null}
    </div>
  );
}

export function PluginPackSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <PluginPackSectionHeader title={title} description={description} />
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {children}
      </div>
    </section>
  );
}

export function packSectionTitle(pack: { name: string; id: string }) {
  const slug = pack.id.split("/").pop() ?? pack.name;
  if (pack.name === "System" && slug && slug !== ".system") {
    return titleFromId(slug);
  }
  return titleFromId(pack.name.replace(/^official\//, ""));
}

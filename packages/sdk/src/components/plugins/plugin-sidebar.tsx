"use client";

import {
  IconBook2,
  IconLayoutGrid,
  IconPalette,
  IconTemplate,
} from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import { formatPluginCount, type PluginNavId } from "./plugin-list-item";
import { PluginSearchFilter } from "./plugin-toolbar";

export type PluginSidebarItem = {
  id: PluginNavId;
  label: string;
  count: number;
  icon?: TablerIcon;
  indent?: boolean;
};

function NavButton({
  item,
  active,
  onSelect,
  compact,
}: {
  item: PluginSidebarItem;
  active: boolean;
  onSelect: (id: PluginNavId) => void;
  compact?: boolean;
}) {
  const Icon = item.icon ?? IconLayoutGrid;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 h-7 text-xs font-medium transition-colors",
          active
            ? "border-border bg-muted text-foreground"
            : "border-transparent bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <Icon className="size-3.5 shrink-0 opacity-70" stroke={1.75} />
        <span>{item.label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatPluginCount(item.count)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 h-7 text-left text-sm transition-colors",
        item.indent && "pl-7",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0 opacity-70" stroke={1.75} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatPluginCount(item.count)}
      </span>
    </button>
  );
}

export function PluginMobileNav({
  items,
  activeId,
  onSelect,
}: {
  items: PluginSidebarItem[];
  activeId: PluginNavId;
  onSelect: (id: PluginNavId) => void;
}) {
  return (
    <div className="shrink-0 border-b border-border bg-background min-[640px]:hidden">
      <div className="overflow-x-auto overscroll-x-contain px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max min-w-full gap-2">
          {items.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeId === item.id}
              onSelect={onSelect}
              compact
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PluginSidebar({
  items,
  activeId,
  search,
  onSearchChange,
  onSelect,
}: {
  items: PluginSidebarItem[];
  activeId: PluginNavId;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: PluginNavId) => void;
}) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-l border-border bg-background min-[640px]:flex min-[900px]:w-64">
      <div className="shrink-0 border-b border-border h-10 px-2">
        <PluginSearchFilter search={search} onSearchChange={onSearchChange} />
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <NavButton
                item={item}
                active={activeId === item.id}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export const PLUGIN_NAV_ICONS = {
  all: IconLayoutGrid,
  templates: IconTemplate,
  themes: IconPalette,
  skills: IconBook2,
} as const;

"use client";

import { IconSearch } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export type PluginTypeFilter = "all" | "templates" | "themes" | "skills";

const TYPE_FILTERS: { id: PluginTypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "templates", label: "Templates" },
  { id: "themes", label: "Themes" },
  { id: "skills", label: "Skills" },
];

export function PluginSearchFilter({
  search,
  onSearchChange,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  className?: string;
}) {
  return (
    <InputGroup className={className ?? "h-7 shadow-none"}>
      <InputGroupAddon align="inline-start">
        <IconSearch className="size-3.5" stroke={1.75} />
      </InputGroupAddon>
      <InputGroupInput
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Filter plugins..."
        className="text-xs"
      />
    </InputGroup>
  );
}

export function PluginGalleryHeader({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: PluginTypeFilter;
  onTypeFilterChange: (type: PluginTypeFilter) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3">
      <InputGroup className="h-9 min-w-0 flex-1 shadow-none">
        <InputGroupAddon align="inline-start">
          <IconSearch className="size-4" stroke={1.75} />
        </InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search plugins..."
          className="text-sm"
        />
      </InputGroup>

      <div className="flex shrink-0 items-center rounded-full border border-border bg-muted/40 p-0.5">
        {TYPE_FILTERS.map((type) => (
          <Button
            key={type.id}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onTypeFilterChange(type.id)}
            className={cn(
              "h-7 rounded-full px-3 shadow-none",
              typeFilter === type.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {type.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

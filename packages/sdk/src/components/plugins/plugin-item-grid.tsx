"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PluginItemGrid<T extends { id: string }>({
  items,
  renderItem,
  className,
}: {
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 min-[680px]:gap-4 min-[900px]:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] min-[1200px]:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.id} className="min-w-0">
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}

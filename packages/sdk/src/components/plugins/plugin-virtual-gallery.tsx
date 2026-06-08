"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { PluginItemCard } from "@/components/plugins/plugin-item-card";
import { PluginItemGrid } from "@/components/plugins/plugin-item-grid";
import { PluginRowScrollContext } from "@/components/plugins/plugin-gallery-context";
import {
  packSectionTitle,
  PluginPackSectionHeader,
} from "@/components/plugins/plugin-pack-section";
import type { PluginListItem, PluginListPack } from "@/components/plugins/types";

const CARD_WIDTH = 220;
const CARD_WIDTH_LG = 240;
const CARD_GAP = 12;
const CARD_ROW_HEIGHT = 230;
const SECTION_ROW_ESTIMATE = CARD_ROW_HEIGHT + 48;

type GalleryItem = PluginListItem & { id: string };

export type PluginGallerySection = {
  pack: PluginListPack;
  items: GalleryItem[];
};

function laneCardWidth(containerWidth: number) {
  return containerWidth >= 900 ? CARD_WIDTH_LG : CARD_WIDTH;
}

function VirtualPluginPackRow({
  pack,
  items,
  onLayoutChange,
}: {
  pack: PluginListPack;
  items: GalleryItem[];
  onLayoutChange?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [cardWidth, setCardWidth] = useState(CARD_WIDTH);
  const [expanded, setExpanded] = useState(false);
  const prevExpandedRef = useRef(expanded);

  const virtualizer = useVirtualizer({
    count: items.length,
    horizontal: true,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => cardWidth,
    gap: CARD_GAP,
    overscan: 1,
  });

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, items.length, cardWidth]);

  useLayoutEffect(() => {
    setScrollEl(expanded ? null : scrollRef.current);
  }, [expanded]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || expanded) return;

    const update = () => {
      setCardWidth(laneCardWidth(el.clientWidth));
      virtualizer.measure();
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [virtualizer, expanded]);

  useLayoutEffect(() => {
    if (prevExpandedRef.current === expanded) return;
    prevExpandedRef.current = expanded;
    onLayoutChange?.();
  }, [expanded, onLayoutChange]);

  const toggleExpanded = () => setExpanded((value) => !value);

  return (
    <section className="space-y-3">
      <PluginPackSectionHeader
        title={packSectionTitle(pack)}
        description={pack.description}
        viewAll={{
          expanded,
          onToggle: toggleExpanded,
        }}
      />
      {expanded ? (
        <PluginItemGrid
          items={items}
          renderItem={(item) => <PluginItemCard item={item} pack={pack} />}
        />
      ) : (
        <div
          ref={scrollRef}
          className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-thin"
        >
          <PluginRowScrollContext value={scrollEl}>
            <div
              className="relative"
              style={{
                width: virtualizer.getTotalSize(),
                height: CARD_ROW_HEIGHT,
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = items[virtualItem.index];
                if (!item) return null;

                return (
                  <div
                    key={virtualItem.key}
                    className="absolute top-0 left-0"
                    style={{
                      width: cardWidth,
                      transform: `translateX(${virtualItem.start}px)`,
                    }}
                  >
                    <PluginItemCard item={item} pack={pack} />
                  </div>
                );
              })}
            </div>
          </PluginRowScrollContext>
        </div>
      )}
    </section>
  );
}

export function VirtualPluginGallery({
  sections,
}: {
  sections: PluginGallerySection[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: sections.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => SECTION_ROW_ESTIMATE,
    overscan: 0,
    gap: 32,
  });

  const rowVirtualizerRef = useRef(rowVirtualizer);
  rowVirtualizerRef.current = rowVirtualizer;

  const handleRowLayoutChange = useCallback(() => {
    rowVirtualizerRef.current.measure();
  }, []);

  useLayoutEffect(() => {
    rowVirtualizer.measure();
  }, [rowVirtualizer, sections.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      rowVirtualizer.measure();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rowVirtualizer]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
      <div
        className="relative w-full"
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const section = sections[virtualRow.index];
          if (!section) return null;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <VirtualPluginPackRow
                pack={section.pack}
                items={section.items}
                onLayoutChange={handleRowLayoutChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

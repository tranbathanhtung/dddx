"use client";

import { memo } from "react";
import type { IWatermarkPanelProps } from "dockview-react";

import { cn } from "@/lib/utils";
import { DOCK_PANELS, openDockPanel, type DockPanelId } from "./panel-registry";

export const DockviewWatermark = memo(function DockviewWatermark(
  props: IWatermarkPanelProps,
) {
  const handleOpen = (panelId: DockPanelId) => {
    openDockPanel(props.containerApi, panelId);
  };

  return (
    <div className="flex h-full w-full items-center justify-center p-6 sm:p-10">
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {DOCK_PANELS.map((panel) => (
          <button
            key={panel.id}
            type="button"
            onClick={() => handleOpen(panel.id)}
            className={cn(
              "flex min-h-32 flex-col gap-3 rounded-md border border-border/60 bg-muted/35 p-5 text-left",
              "transition-colors hover:bg-muted/60",
            )}
          >
            <panel.icon className="size-5 text-muted-foreground" stroke={1.6} />
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">
                {panel.title}
              </div>
              <div className="text-sm text-muted-foreground">
                {panel.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

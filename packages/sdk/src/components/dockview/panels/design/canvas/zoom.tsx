import { Panel, useReactFlow, useViewport } from "@xyflow/react";
import { memo } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconFocus,
  IconMaximize,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FIT_OPTS } from "./layout";

export const ZoomMenu = memo(function ZoomMenu() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <Panel position="bottom-left">
      <div className="flex items-center gap-2 text-sm font-medium">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full">
              <IconCheck className="size-3 text-muted-foreground" />
              <span className="text-xs font-medium">
                {Math.round(zoom * 100)}%
              </span>
              <IconChevronDown className="size-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56" sideOffset={8}>
            <DropdownMenuItem onSelect={() => zoomIn()}>
              <IconZoomIn className="mr-2 size-3" />
              Zoom in
              <DropdownMenuShortcut>⌘+</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => zoomOut()}>
              <IconZoomOut className="mr-2 size-3" />
              Zoom out
              <DropdownMenuShortcut>⌘−</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => zoomTo(1)}>
              <IconMaximize className="mr-2 size-3" />
              Zoom to 100%
              <DropdownMenuShortcut>⇧0</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => fitView(FIT_OPTS)}>
              <IconMaximize className="mr-2 size-3" />
              Zoom to Fit
              <DropdownMenuShortcut>⇧1</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => fitView({ ...FIT_OPTS, nodes: [] })}
            >
              <IconFocus className="mr-2 size-3" />
              Zoom to Selection
              <DropdownMenuShortcut>⇧2</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Panel>
  );
});

import { memo } from "react";
import { IconPlus } from "@tabler/icons-react";
import { type IDockviewHeaderActionsProps } from "dockview-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DOCK_PANELS, type DockPanelId } from "./panel-registry";
import { CustomEventEnum, dispatch } from "@/lib/custom-event";

export const LeftHeaderActionsComponent = memo(
  (_props: IDockviewHeaderActionsProps) => {
    const handleOpen = (panelId: DockPanelId) => {
      dispatch(CustomEventEnum.OpenDockPanel, { detail: { panelId } });
    };

    return (
      <div className="flex h-full items-center px-1 text-muted-foreground">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Add panel"
              size="icon-sm"
              variant="ghost"
              className="rounded-sm"
            >
              <IconPlus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-44">
            {DOCK_PANELS.map((panel) => (
              <DropdownMenuItem
                key={panel.id}
                onSelect={() => handleOpen(panel.id)}
              >
                <panel.icon className="size-4" stroke={1.6} />
                {panel.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  },
);

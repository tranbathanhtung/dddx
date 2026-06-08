import { type IDockviewHeaderActionsProps } from "dockview-react";
import { memo, useLayoutEffect } from "react";
import { IconArrowsMaximize } from "@tabler/icons-react";
import { ActiveButtons, ExtMenu } from "@/extensions/ui/menu";
import { setActiveBridge } from "@/components/dockview/panels/preview/bridge-registry";
import { useStudioStore } from "@/store";
import { isPreviewPanelId } from "./panel-registry";
import { Button } from "../ui/button";

export const RightActionsComponent = memo(
  (props: IDockviewHeaderActionsProps) => {
    const toggleMaximized = useStudioStore((s) => s.ui.toggleMaximized);
    const previewPanelId =
      props.activePanel?.id && isPreviewPanelId(props.activePanel.id)
        ? props.activePanel.id
        : null;

    useLayoutEffect(() => {
      if (props.isGroupActive && previewPanelId) {
        setActiveBridge(previewPanelId);
      }
    }, [previewPanelId, props.isGroupActive]);

    if (!props.isGroupActive) return null;

    return (
      <div className="flex h-full items-center gap-0.5 px-2 text-muted-foreground">
        {previewPanelId ? (
          <>
            <ActiveButtons />
            <ExtMenu />
          </>
        ) : null}
        <Button
          aria-label="Maximize layout"
          size="icon-sm"
          variant="ghost"
          onClick={toggleMaximized}
        >
          <IconArrowsMaximize />
        </Button>
      </div>
    );
  },
);

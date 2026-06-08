import { memo, useRef, useState } from "react";
import {
  IconChevronDown,
  IconCopyPlus,
  IconRefresh,
  IconSparkles,
} from "@tabler/icons-react";

import { CustomEventEnum, dispatch } from "@/lib/custom-event";
import { cn } from "@/lib/utils";

type GenerateMenuProps = {
  nodeId: string;
  label: string;
};

export const GenerateMenu = memo(function GenerateMenu({
  nodeId,
  label,
}: GenerateMenuProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const keepOpen = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const onRegenerate = () => {
    setOpen(false);
    dispatch(CustomEventEnum.DesignCanvasRequestSend, {
      detail: {
        nodeId,
        text: `Regenerate "${label}" with a fresh take while keeping the same purpose and constraints.`,
      },
    });
  };

  const onVariants = () => {
    setOpen(false);
    dispatch(CustomEventEnum.DesignCanvasOpenVariants, {
      detail: { nodeId },
    });
  };

  return (
    <div
      className="relative"
      onMouseEnter={keepOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={cn(
          "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground",
        )}
      >
        <IconSparkles className="size-4" />
        <span className="text-sm font-medium">Generate</span>
        <IconChevronDown className="size-3 opacity-70" />
      </button>

      {open ? (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-44 rounded-lg border bg-popover p-1 shadow-long">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            onClick={onVariants}
          >
            <IconCopyPlus className="size-4 text-muted-foreground" />
            <span className="flex-1 text-left">Variations</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              ⇧V
            </span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            onClick={onRegenerate}
          >
            <IconRefresh className="size-4 text-muted-foreground" />
            <span className="flex-1 text-left">Regenerate</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              ⇧R
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
});

import { memo, useMemo, useState, type ReactNode } from "react";
import { NodeResizer, NodeToolbar, Position } from "@xyflow/react";
import type { TablerIcon } from "@tabler/icons-react";

import { NodeLoadingOverlay } from "../node-loading";

type FrameChromeProps = {
  width: number;
  height: number;
  label: string;
  selected: boolean;
  live: boolean;
  busy: boolean;
  busyLabel: string;
  imageGenerating: boolean;
  icon: TablerIcon;
  onResize: (_: unknown, params: { width: number; height: number }) => void;
  toolbarExtra?: ReactNode;
  ringOnSelect?: boolean;
  ringOnFocusWithin?: boolean;
  children: ReactNode;
};

export const FrameChrome = memo(function FrameChrome({
  width,
  height,
  label,
  selected,
  live,
  busy,
  busyLabel,
  imageGenerating,
  icon: Icon,
  onResize,
  toolbarExtra,
  ringOnSelect = true,
  ringOnFocusWithin = false,
  children,
}: FrameChromeProps) {
  const [hover, setHover] = useState(false);

  const ringClass = useMemo(() => {
    if (live || (ringOnSelect && selected)) return "ring-3 ring-blue-500";
    return "";
  }, [live, ringOnSelect, selected]);

  const shellClass = useMemo(() => {
    const parts = [
      "relative group cursor-default shadow-none border-0 bg-background transition-[box-shadow,border-color] ease-in-out duration-75",
      ringClass,
    ];
    if (ringOnFocusWithin) {
      parts.push("focus-within:ring-3 focus-within:ring-blue-500");
    }
    if (ringOnSelect || !selected) {
      parts.push("hover:ring-3 hover:ring-blue-500");
    }
    return parts.join(" ");
  }, [ringClass, ringOnFocusWithin, ringOnSelect, selected]);

  const toolbarClass = useMemo(
    () =>
      selected
        ? "flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 shadow-sm text-sm"
        : `text-sm font-medium ${hover ? "text-blue-600" : "text-muted-foreground"}`,
    [selected, hover],
  );

  return (
    <>
      <div
        className={`${shellClass} overflow-hidden`}
        style={{ width, height }}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={200}
          minHeight={150}
          onResize={onResize}
          lineClassName="border-none!"
          handleClassName="w-2! h-2! rounded-none bg-background! border-blue-500!"
        />
        {children}
        {busy ? (
          <NodeLoadingOverlay
            label={imageGenerating ? "Generating…" : busyLabel}
          />
        ) : null}
      </div>

      <NodeToolbar
        isVisible
        position={Position.Top}
        offset={selected ? 12 : 6}
        align={selected ? "center" : "start"}
        className={toolbarClass}
      >
        {selected ? (
          <>
            <Icon className="size-4 text-muted-foreground" />
            <span className="font-medium">{label}</span>
            {toolbarExtra}
          </>
        ) : (
          label
        )}
      </NodeToolbar>

      {selected ? (
        <NodeToolbar
          isVisible
          position={Position.Bottom}
          offset={12}
          className="rounded-md bg-blue-500 px-2 py-0.5 text-xs font-medium tabular-nums text-white"
        >
          {Math.round(width)} × {Math.round(height)}
        </NodeToolbar>
      ) : null}
    </>
  );
});

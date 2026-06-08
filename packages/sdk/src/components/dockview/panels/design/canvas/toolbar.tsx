import { Panel } from "@xyflow/react";
import { Fragment, memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconHandGrab,
  IconImageGeneration,
  IconLayoutGrid,
  IconPointer2,
  IconUpload,
} from "@tabler/icons-react";

export type Tool =
  | "select"
  | "pan"
  | "shape"
  | "pen"
  | "image"
  | "magic"
  | "layout";

const items = [
  { id: "select", icon: IconPointer2, label: "Select" },
  { id: "pan", icon: IconHandGrab, label: "Hand" },
  {
    id: "layout",
    icon: IconLayoutGrid,
    label: "Auto layout",
    divider: true,
  },
  {
    id: "image",
    icon: IconImageGeneration,
    label: "Image Generation",
  },
  {
    id: "upload",
    icon: IconUpload,
    label: "Upload",
    action: "upload" as const,
  },
] as const;

export const CanvasToolbar = memo(function CanvasToolbar({
  tool,
  onTool,
  onUpload,
  uploadOff,
  imageOff,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  onUpload?: () => void;
  uploadOff?: boolean;
  imageOff?: boolean;
}) {
  return (
    <Panel position="top-left">
      <div className="bg-card text-card-foreground rounded-full shadow-button border-0 border-border p-1 flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isUpload = "action" in item && item.action === "upload";
          const isImage = item.id === "image";
          const on = !isUpload && tool === item.id;
          return (
            <Fragment key={item.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      onClick={() => {
                        if (isUpload) {
                          onUpload?.();
                          return;
                        }
                        onTool(item.id as Tool);
                      }}
                      variant={on ? "default" : "ghost"}
                      size="icon"
                      className="rounded-full"
                      disabled={
                        (isUpload && uploadOff) || (isImage && imageOff)
                      }
                    >
                      <Icon className="size-3.5" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  {item.label}
                </TooltipContent>
              </Tooltip>
              {"divider" in item && item.divider && (
                <div className="w-full h-px bg-border my-0.5" />
              )}
            </Fragment>
          );
        })}
      </div>
    </Panel>
  );
});

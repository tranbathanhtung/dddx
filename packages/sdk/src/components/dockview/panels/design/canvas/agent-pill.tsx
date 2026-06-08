import { Panel } from "@xyflow/react";
import { memo } from "react";

export const AgentPill = memo(function AgentPill({
  name,
  onJump,
}: {
  name: string;
  onJump: () => void;
}) {
  return (
    <Panel position="bottom-right">
      <button
        type="button"
        onClick={onJump}
        className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs shadow-button backdrop-blur transition-colors hover:bg-muted/80"
        title={`Jump to ${name}`}
      >
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
        </span>
        <span className="text-muted-foreground">
          Designing in{" "}
          <span className="font-medium text-foreground">{name}</span>
        </span>
      </button>
    </Panel>
  );
});

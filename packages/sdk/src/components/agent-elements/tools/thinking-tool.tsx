import { memo, useMemo } from "react";
import type { TimelineStep, StepState } from "../types/timeline";
import { useToolComplete } from "../hooks/use-tool-complete";
import { ToolRowBase } from "./tool-row-base";
import {
  mapToolInvocationToStep,
  mapToolStateToStepState,
} from "../utils/tool-adapters";

export type ThinkingCollapsedProps = {
  step: Extract<TimelineStep, { type: "tool-call" }>;
  state: StepState;
  onComplete: () => void;
  defaultOpen?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
};

export function ThinkingCollapsed({
  step,
  state,
  onComplete,
  defaultOpen,
  expanded,
  onToggleExpand,
}: ThinkingCollapsedProps) {
  useToolComplete(state === "animating", step.duration, onComplete);

  return (
    <ToolRowBase
      shimmerLabel="Thinking"
      completeLabel="Thought"
      isAnimating={state === "animating"}
      expandable={!!step.thoughtContent}
      defaultOpen={defaultOpen}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="max-h-[175px] overflow-y-auto">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {step.thoughtContent}
        </p>
      </div>
    </ToolRowBase>
  );
}

const noop = () => {};

export type ThinkingToolProps = {
  part?: any;
  step?: Extract<TimelineStep, { type: "tool-call" }>;
  state?: StepState;
  onComplete?: () => void;
  defaultOpen?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
};

export const ThinkingTool = memo(function ThinkingTool({
  part,
  step: externalStep,
  state: externalState,
  onComplete: externalOnComplete,
  defaultOpen,
  expanded,
  onToggleExpand,
}: ThinkingToolProps) {
  const derived = useMemo(() => {
    if (externalStep && externalState && externalOnComplete) {
      return {
        step: externalStep,
        stepState: externalState,
        onComplete: externalOnComplete,
      };
    }
    if (!part) return null;

    const mappedState =
      part.state === "output-available"
        ? "result"
        : part.state === "input-streaming"
          ? "partial-call"
          : "call";

    return {
      step: mapToolInvocationToStep(part.toolCallId ?? part.id ?? "thinking", {
        toolName: "Thinking",
        args: part.input ?? part.args ?? {},
        state: mappedState,
        result: part.output ?? part.result,
      }),
      stepState: mapToolStateToStepState(mappedState),
      onComplete: noop,
    };
  }, [externalStep, externalState, externalOnComplete, part]);

  if (!derived) return null;

  return (
    <ThinkingCollapsed
      step={derived.step}
      state={derived.stepState}
      onComplete={derived.onComplete}
      defaultOpen={defaultOpen}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    />
  );
});

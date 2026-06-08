import {
  memo,
  useCallback,
  type ComponentType,
  type ReactNode,
} from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import type { TablerIcon } from "@tabler/icons-react";

import { frameNodeEqual } from "./equal";
import { FrameChrome } from "./frame-chrome";
import type { FrameContentProps, NodeData } from "./types";

type RingOption = boolean | ((data: NodeData) => boolean);

function resolveRing(option: RingOption | undefined, data: NodeData, fallback: boolean) {
  if (option === undefined) return fallback;
  return typeof option === "function" ? option(data) : option;
}

type CreateFrameNodeOptions = {
  Content: ComponentType<FrameContentProps>;
  icon: (data: NodeData) => TablerIcon;
  toolbarExtra?: (props: {
    id: string;
    data: NodeData;
    selected: boolean;
  }) => ReactNode;
  ringOnSelect?: RingOption;
  ringOnFocusWithin?: RingOption;
};

export function createFrameNode({
  Content,
  icon,
  toolbarExtra,
  ringOnSelect,
  ringOnFocusWithin,
}: CreateFrameNodeOptions) {
  return memo(function FrameNode({ id, data, selected }: NodeProps) {
    const nodeData = (data as unknown as NodeData) || {};
    const {
      width,
      height,
      label,
      __interactive: live,
      fileActivity,
      imageGenerating,
    } = nodeData;

    const updating = fileActivity === "updating";
    const loading = !!fileActivity || !!imageGenerating;
    const blank = fileActivity === "creating" || !!imageGenerating;
    const busyLabel = updating ? "Updating…" : "Creating…";
    const Icon = icon(nodeData);

    const { updateNodeData } = useReactFlow();

    const onResize = useCallback(
      (_: unknown, params: { width: number; height: number }) => {
        updateNodeData(id, { width: params.width, height: params.height });
      },
      [id, updateNodeData],
    );

    return (
      <FrameChrome
        width={width}
        height={height}
        label={label}
        selected={!!selected}
        live={!!live}
        busy={loading}
        busyLabel={busyLabel}
        imageGenerating={!!imageGenerating}
        icon={Icon}
        onResize={onResize}
        ringOnSelect={resolveRing(ringOnSelect, nodeData, true)}
        ringOnFocusWithin={resolveRing(ringOnFocusWithin, nodeData, false)}
        toolbarExtra={toolbarExtra?.({
          id,
          data: nodeData,
          selected: !!selected,
        })}
      >
        <Content id={id} data={nodeData} live={!!live} busy={blank} />
      </FrameChrome>
    );
  }, frameNodeEqual);
}

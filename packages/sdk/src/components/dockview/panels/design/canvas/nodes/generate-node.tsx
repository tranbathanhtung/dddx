import { memo, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

import { CustomEventEnum, dispatch } from "@/lib/custom-event";
import type { ImageGenerateConfig } from "@/lib/image-generation";
import { ImageGeneratePanel } from "../image-generate-panel";
import type { FrameContentProps } from "./types";

export const GenerateNode = memo(function GenerateNode({
  id,
  data,
  busy,
}: FrameContentProps) {
  const { workspaceId, generateImage } = data;
  const { updateNodeData } = useReactFlow();

  const onConfigChange = useCallback(
    (patch: Partial<ImageGenerateConfig>) => {
      if (!generateImage) return;
      updateNodeData(id, {
        generateImage: { ...generateImage, ...patch },
      });
    },
    [id, updateNodeData, generateImage],
  );

  const onBusyChange = useCallback(
    (active: boolean) => {
      updateNodeData(id, { imageGenerating: active });
    },
    [id, updateNodeData],
  );

  const onGenerated = useCallback(
    ({ path }: { path: string }) => {
      if (!workspaceId) return;
      dispatch(CustomEventEnum.DesignCanvasImageGenerated, {
        detail: { nodeId: id, workspaceId, path },
      });
    },
    [id, workspaceId],
  );

  if (!workspaceId || !generateImage) return null;

  return (
    <ImageGeneratePanel
      workspaceId={workspaceId}
      config={generateImage}
      onConfigChange={onConfigChange}
      onBusyChange={onBusyChange}
      onGenerated={onGenerated}
      busy={busy}
    />
  );
});

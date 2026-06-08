import { memo, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

import { CustomEventEnum, dispatch } from "@/lib/custom-event";
import type { ImageGenerateConfig } from "@/lib/image-generation";
import { ImageGeneratePanel } from "../image-generate-panel";
import type { FrameContentProps } from "./types";

export const ImageNode = memo(function ImageNode({
  id,
  data,
  busy,
}: FrameContentProps) {
  const { label, src, filePath, workspaceId, imageEdit } = data;
  const { updateNodeData } = useReactFlow();

  const onConfigChange = useCallback(
    (patch: Partial<ImageGenerateConfig>) => {
      if (!imageEdit) return;
      updateNodeData(id, {
        imageEdit: { ...imageEdit, ...patch },
      });
    },
    [id, updateNodeData, imageEdit],
  );

  const onBusyChange = useCallback(
    (active: boolean) => {
      updateNodeData(id, { imageGenerating: active });
    },
    [id, updateNodeData],
  );

  const onGenerated = useCallback(
    ({ path }: { path: string }) => {
      if (!workspaceId || !filePath) return;
      dispatch(CustomEventEnum.DesignCanvasImageGenerated, {
        detail: {
          nodeId: id,
          workspaceId,
          path,
          replace: true,
        },
      });
    },
    [id, workspaceId, filePath],
  );

  const onCancelEdit = useCallback(() => {
    updateNodeData(id, { imageEdit: undefined });
  }, [id, updateNodeData]);

  if (imageEdit && workspaceId && filePath) {
    return (
      <ImageGeneratePanel
        mode="edit"
        workspaceId={workspaceId}
        config={imageEdit}
        sourcePath={filePath}
        replacePath={filePath}
        onConfigChange={onConfigChange}
        onBusyChange={onBusyChange}
        onGenerated={onGenerated}
        onCancel={onCancelEdit}
        busy={busy}
      />
    );
  }

  if (!src) return null;

  return (
    <img
      src={src}
      alt={label}
      className="block size-full bg-muted"
      draggable={false}
      loading="lazy"
    />
  );
});

import { memo } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { useReactFlow } from "@xyflow/react";

import {
  defaultImageGenerateConfig,
  useImageGenerationCatalog,
} from "@/lib/image-generation";
import { useImageGenerationPrefs } from "@/store";

type ImageNodeToolbarProps = {
  nodeId: string;
  filePath?: string;
  workspaceId?: string;
};

export const ImageNodeToolbar = memo(function ImageNodeToolbar({
  nodeId,
  filePath,
  workspaceId,
}: ImageNodeToolbarProps) {
  const { updateNodeData } = useReactFlow();
  const catalogQuery = useImageGenerationCatalog();
  const imagePrefs = useImageGenerationPrefs();

  const onEdit = () => {
    if (!filePath || !workspaceId || !catalogQuery.data) return;
    updateNodeData(nodeId, {
      imageEdit: defaultImageGenerateConfig(catalogQuery.data, imagePrefs),
    });
  };

  return (
    <>
      <span className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        disabled={!filePath || !workspaceId || catalogQuery.isPending}
        onClick={onEdit}
      >
        <IconSparkles className="size-4" />
        <span className="text-sm font-medium">Edit with AI</span>
      </button>
    </>
  );
});

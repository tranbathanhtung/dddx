import { IconPhoto } from "@tabler/icons-react";

import { createFrameNode } from "./create-frame-node";
import { ImageNode } from "./image-node";
import { ImageNodeToolbar } from "./image-node-toolbar";

export const ImageFrameNode = createFrameNode({
  Content: ImageNode,
  icon: () => IconPhoto,
  ringOnFocusWithin: (data) => !!data.imageEdit,
  toolbarExtra: ({ id, data, selected }) =>
    selected && !data.imageEdit ? (
      <ImageNodeToolbar
        nodeId={id}
        filePath={data.filePath}
        workspaceId={data.workspaceId}
      />
    ) : null,
});

import { IconPhoto } from "@tabler/icons-react";

import { createFrameNode } from "./create-frame-node";
import { GenerateNode } from "./generate-node";

export const GenerateFrameNode = createFrameNode({
  Content: GenerateNode,
  icon: () => IconPhoto,
  ringOnSelect: false,
  ringOnFocusWithin: true,
});

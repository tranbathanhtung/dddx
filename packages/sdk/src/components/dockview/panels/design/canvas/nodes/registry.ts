import type { NodeTypes } from "@xyflow/react";

import { GenerateFrameNode } from "./generate-frame-node";
import { HtmlFrameNode } from "./html-frame-node";
import { ImageFrameNode } from "./image-frame-node";
import { VideoFrameNode } from "./video-frame-node";

export const canvasNodeTypes: NodeTypes = {
  html: HtmlFrameNode,
  image: ImageFrameNode,
  video: VideoFrameNode,
  generate: GenerateFrameNode,
};

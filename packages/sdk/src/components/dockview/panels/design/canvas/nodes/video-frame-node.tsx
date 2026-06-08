import { IconVideo } from "@tabler/icons-react";

import { createFrameNode } from "./create-frame-node";
import { VideoNode } from "./video-node";

export const VideoFrameNode = createFrameNode({
  Content: VideoNode,
  icon: () => IconVideo,
});

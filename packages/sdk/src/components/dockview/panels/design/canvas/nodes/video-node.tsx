import { memo } from "react";

import type { FrameContentProps } from "./types";

export const VideoNode = memo(function VideoNode({
  data,
  live,
}: FrameContentProps) {
  const { src } = data;
  if (!src) return null;

  return (
    <video
      src={src}
      className="block size-full bg-black"
      controls={live}
      muted
      playsInline
      loop
      style={{ pointerEvents: live ? "auto" : "none" }}
    />
  );
});

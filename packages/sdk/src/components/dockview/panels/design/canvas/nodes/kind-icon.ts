import {
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDeviceTablet,
  IconPhoto,
  IconVideo,
} from "@tabler/icons-react";

import type { CanvasMediaKind, FramePreset } from "@/lib/design-canvas-files";

export function kindIcon(
  kind: CanvasMediaKind = "html",
  framePreset?: FramePreset,
) {
  if (kind === "image") return IconPhoto;
  if (kind === "video") return IconVideo;
  if (framePreset === "mobile") return IconDeviceMobile;
  if (framePreset === "tablet") return IconDeviceTablet;
  return IconDeviceDesktop;
}

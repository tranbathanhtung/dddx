"use client";

import { memo } from "react";
import { Canvas } from "./canvas";

export const DesignPanel = memo(function DesignPanel() {
  return (
    <div className="h-full">
      <Canvas />
    </div>
  );
});

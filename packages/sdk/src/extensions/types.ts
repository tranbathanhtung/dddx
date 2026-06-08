import type { ComponentType } from "react";

export type ExtLogoProps = {
  className?: string;
};

export type Ext = {
  id: string;
  name: string;
  logo: ComponentType<ExtLogoProps>;
  /** IIFE injected into the preview iframe via devtools. */
  script: string;
};

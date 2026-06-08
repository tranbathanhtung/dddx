"use client";

import { createContext, useContext } from "react";

export const PluginRowScrollContext = createContext<HTMLElement | null>(null);

export function usePluginRowScrollRoot() {
  return useContext(PluginRowScrollContext);
}

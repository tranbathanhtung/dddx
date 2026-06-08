import type { Remote } from "comlink";

import type { ChildApi } from "./types";

type ChildGetter = () => Remote<ChildApi> | null;

const bridges = new Map<string, ChildGetter>();
let activeId: string | null = null;

export function registerBridge(id: string, getChild: ChildGetter) {
  bridges.set(id, getChild);
}

export function unregisterBridge(id: string) {
  bridges.delete(id);
  if (activeId === id) activeId = null;
}

export function setActiveBridge(id: string | null) {
  activeId = id;
}

export function getActiveBridgeId() {
  return activeId;
}

export function getBridgeChild(id: string) {
  return bridges.get(id)?.() ?? null;
}

export function getActiveBridgeChild() {
  if (!activeId) return null;
  return getBridgeChild(activeId);
}

import { getActiveBridgeChild } from "@/components/dockview/panels/preview/bridge-registry";

export async function inject(id: string, script: string) {
  const api = getActiveBridgeChild();
  if (!api) return false;
  await api.injectExtension(id, script);
  return true;
}

export async function dispose(id: string) {
  const api = getActiveBridgeChild();
  if (!api) return false;
  await api.disposeExtension(id);
  return true;
}

/** Fires `dddx.action.onClicked` in the preview iframe. */
export async function click(id: string) {
  const api = getActiveBridgeChild();
  if (!api) return false;
  await api.clickExtension(id);
  return true;
}

import { dispose, inject } from "./bridge";
import { get } from "./registry";
import type { ChildApi } from "@/components/dockview/panels/preview/types";
import type { Remote } from "comlink";
import { getActiveBridgeChild } from "@/components/dockview/panels/preview/bridge-registry";

function resolveChild(api?: Remote<ChildApi> | null) {
  return api ?? getActiveBridgeChild();
}

export async function sync(id: string, on: boolean) {
  const ext = get(id);
  if (!ext) return;

  if (on) {
    await inject(id, ext.script);
    return;
  }

  await dispose(id);
}

export async function replay(
  ids: readonly string[],
  api?: Remote<ChildApi> | null,
) {
  const child = resolveChild(api);
  if (!child) return;

  for (const id of ids) {
    const ext = get(id);
    if (!ext) continue;
    await child.injectExtension(id, ext.script);
  }
}

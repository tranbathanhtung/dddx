import { useMemo } from "react";

import { useStudioStore } from "@/store";
import type { Remote } from "comlink";
import type { ChildApi } from "@/components/dockview/panels/preview/types";
import { replay } from "./sync";

export function useActiveIds() {
  return useStudioStore((s) => s.extension.active);
}

export function useActive() {
  const activeIds = useActiveIds();
  const toggle = useStudioStore((s) => s.extension.toggle);
  const active = useMemo(() => new Set(activeIds), [activeIds]);
  return { active, activeIds, toggle };
}

export async function replayActive(api?: Remote<ChildApi> | null) {
  const ids = useStudioStore.getState().extension.active;
  await replay(ids, api);
}

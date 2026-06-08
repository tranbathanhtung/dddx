import { useCallback, useEffect, useMemo } from "react";

import { api } from "@/client";
import { useCurrentAgent } from "@/hooks/use-agents";
import type { WorkspaceOption } from "@/components/agent-elements/input/workspace-selector";
import { resolveCanvasActiveWorkspace } from "@/lib/resolve-canvas-workspace";

/** Workspace list + the currently active design workspace. */
export function useWorkspaces() {
  const { setting, setPrefs } = useCurrentAgent();
  const query = api.project.workspaces.list.useQuery();

  const options = useMemo<WorkspaceOption[]>(
    () =>
      (query.data?.workspaces ?? [])
        .filter((w) => w.kind === "prototype")
        .map((w) => ({ id: w.id, name: w.name, kind: w.kind })),
    [query.data?.workspaces],
  );

  const first = options[0]?.id;
  const wanted = setting.workspace ?? "main";
  const active = resolveCanvasActiveWorkspace({
    wanted,
    optionIds: options.map((w) => w.id),
    first,
    listReady: query.isSuccess,
    listFetching: query.isFetching,
  });
  const valid = wanted !== "main" && options.some((w) => w.id === wanted);

  const setWs = useCallback((id: string) => setPrefs({ workspace: id }), [setPrefs]);

  useEffect(() => {
    if (first && active === first && !valid) setWs(first);
  }, [active, first, valid, setWs]);

  const create = api.project.workspaces.create.useMutation({
    onSuccess: async (data) => {
      await query.refetch();
      setWs(data.workspace.id);
    },
  });

  return {
    options,
    active,
    setWs,
    create,
    ready: query.isSuccess,
    refetch: query.refetch,
  };
}

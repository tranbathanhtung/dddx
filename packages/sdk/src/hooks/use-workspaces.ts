import { useEffect, useMemo } from "react";

import { api } from "@/client";
import { useStudioStoreHydrated, type AgentSetting } from "@/store";

const MAIN_WORKSPACE_ID = "main";

export interface UseWorkspacesOptions {
  setting: AgentSetting;
  setPrefs: (patch: { workspace?: string }) => void;
}

/**
 * Resolves the persisted workspace id for chat overrides (e.g. when the user
 * picks a design folder in the canvas). Server-side mode routing handles
 * the default write target; this is only an explicit override.
 */
export function useWorkspaces({ setting, setPrefs }: UseWorkspacesOptions) {
  const hydrated = useStudioStoreHydrated();
  const workspacesQuery = api.project.workspaces.list.useQuery();

  const workspaceOptions = useMemo(
    () => workspacesQuery.data?.workspaces ?? [],
    [workspacesQuery.data?.workspaces],
  );

  const workspaceId = useMemo(() => {
    const selected = setting.workspace ?? MAIN_WORKSPACE_ID;

    if (!workspacesQuery.isFetched) {
      return selected;
    }

    if (workspaceOptions.some((w) => w.id === selected)) {
      return selected;
    }

    // Agent auto-create: keep selection until workspaces.list refetches.
    if (
      workspacesQuery.isFetching &&
      selected !== MAIN_WORKSPACE_ID
    ) {
      return selected;
    }

    return MAIN_WORKSPACE_ID;
  }, [
    setting.workspace,
    workspaceOptions,
    workspacesQuery.isFetched,
    workspacesQuery.isFetching,
  ]);

  useEffect(() => {
    if (!workspacesQuery.isFetched || workspacesQuery.isFetching) return;
    if (
      setting.workspace &&
      setting.workspace !== MAIN_WORKSPACE_ID &&
      !workspaceOptions.some((w) => w.id === setting.workspace)
    ) {
      setPrefs({ workspace: MAIN_WORKSPACE_ID });
    }
  }, [
    workspacesQuery.isFetched,
    workspacesQuery.isFetching,
    workspaceOptions,
    setting.workspace,
    setPrefs,
  ]);

  return {
    workspaceId,
    isWorkspaceReady: hydrated,
  };
}

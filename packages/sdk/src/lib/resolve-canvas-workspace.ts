const MAIN_WORKSPACE_ID = "main";

/** Pick the canvas workspace id from prefs + the loaded prototype list. */
export function resolveCanvasActiveWorkspace(args: {
  wanted: string;
  optionIds: string[];
  first?: string;
  listReady: boolean;
  listFetching: boolean;
}): string | undefined {
  const { wanted, optionIds, first, listReady, listFetching } = args;

  if (wanted !== MAIN_WORKSPACE_ID) {
    if (optionIds.includes(wanted)) return wanted;
    // Agent auto-create: trust prefs until workspaces.list catches up.
    if (!listReady || listFetching) return wanted;
    return first;
  }

  return first;
}

import { api } from "@/client";

export function usePreviewTargets() {
  const query = api.project.preview.targets.useQuery(undefined, {
    refetchInterval: 5_000,
  });

  return {
    targets: query.data?.targets ?? [],
    defaultTargetId: query.data?.defaultTargetId ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

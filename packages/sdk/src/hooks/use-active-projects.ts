import { api } from "@/client";

export function useActiveProjects() {
  const query = api.project.active.list.useQuery(undefined, {
    refetchInterval: 5_000,
  });

  return {
    projects: query.data?.projects ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

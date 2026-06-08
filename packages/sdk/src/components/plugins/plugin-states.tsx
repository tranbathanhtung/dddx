import { IconLayoutGrid } from "@tabler/icons-react";

const SKELETON_GRID =
  "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 min-[680px]:gap-4 min-[900px]:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] min-[1200px]:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]";

function PluginCardSkeleton() {
  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="aspect-[16/10] animate-pulse bg-muted" />

      <div className="flex min-h-0 flex-1 flex-col gap-1 pt-2.5">
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />

        <div className="space-y-1.5">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        </div>

        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="size-0.5 shrink-0 rounded-full bg-muted opacity-50" />
          <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function PluginLoadingState() {
  return (
    <div className={SKELETON_GRID}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="min-w-0">
          <PluginCardSkeleton />
        </div>
      ))}
    </div>
  );
}

export function PluginEmptyState() {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
      <IconLayoutGrid className="size-8 opacity-40" stroke={1.25} />
      <div>No plugins found.</div>
    </div>
  );
}

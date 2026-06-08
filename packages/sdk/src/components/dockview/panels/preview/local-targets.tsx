import { memo, useState } from "react";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type LocalPreviewTarget = {
  id: string;
  label: string;
  url: string;
  port: number;
  path?: string;
};

function displayHost(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
  } catch {
    return url;
  }
}

const TargetCard = memo(function TargetCard({
  target,
  active,
  onSelect,
}: {
  target: LocalPreviewTarget;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full max-w-md items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors",
        active
          ? "border-foreground/10"
          : "border-border/70 hover:border-border hover:bg-muted/30",
      )}
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
        <iframe
          src={target.url}
          title={target.label}
          tabIndex={-1}
          className="pointer-events-none size-[200%] origin-top-left scale-50 border-0"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {target.label}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {displayHost(target.url)}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs",
            active
              ? "border-foreground/15 bg-muted text-foreground"
              : "border-border text-muted-foreground",
          )}
        >
          {active ? "This chat" : "Open"}
        </span>
      </div>
    </button>
  );
});

export const LocalTargets = memo(function LocalTargets({
  targets,
  activeId,
  onSelect,
}: {
  targets: LocalPreviewTarget[];
  activeId?: string | null;
  onSelect: (target: LocalPreviewTarget) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? targets.filter((target) => {
        const q = query.trim().toLowerCase();
        return (
          target.label.toLowerCase().includes(q) ||
          target.url.toLowerCase().includes(q) ||
          target.path?.toLowerCase().includes(q)
        );
      })
    : targets;

  if (targets.length === 0) return null;

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-md">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Local</h2>
          {targets.length > 1 ? (
            <label className="relative flex items-center">
              <IconAdjustmentsHorizontal
                size={14}
                className="pointer-events-none absolute left-2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter"
                className="h-7 w-28 rounded-md border border-transparent bg-transparent pl-7 pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground hover:border-border focus:border-border"
              />
            </label>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          {filtered.map((target) => (
            <TargetCard
              key={target.id}
              target={target}
              active={target.id === activeId}
              onSelect={() => onSelect(target)}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

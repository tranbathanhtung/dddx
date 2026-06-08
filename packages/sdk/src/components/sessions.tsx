"use client";

import { useCurrentAgent } from "@/hooks/use-agents";
import {
  supportsPersistedSessions,
  supportsSessionList,
} from "@/lib/agent-capabilities";
import { api } from "@/client";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  memo,
  type PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Spinner } from "./ui/spinner";
import { cn } from "@/lib/utils";
import { IconCircleCheck, IconAlertTriangle } from "@tabler/icons-react";

/** Mirrors ACP `SessionInfo` from `session/list` (see agent tRPC `listSessions`). */
type ListedSession = {
  sessionId: string;
  cwd: string;
  title?: string | null;
  updatedAt?: string | null;
};

export const SessionHistory = memo(
  ({
    children,
    container,
  }: PropsWithChildren & {
    container?: React.RefObject<HTMLDivElement | null>;
  }) => {
    const [open, setOpen] = useState(false);
    const isMobile = useIsMobile();

    if (!isMobile) {
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{children}</PopoverTrigger>
          <PopoverContent
            className="w-[calc(var(--sidebar-width)-0px)] rounded-none p-0 z-100"
            align="center"
            alignOffset={0}
            side="bottom"
            container={container?.current}
            collisionBoundary={container?.current}
          >
            <SessionList open={open} setOpen={setOpen} />
          </PopoverContent>
        </Popover>
      );
    }
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent>
          <DrawerTitle className="hidden" />
          <div className="mt-4 border-t">
            <SessionList open={open} setOpen={setOpen} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  },
);

/** @deprecated Use {@link SessionHistory} */
export const TaskHistory = SessionHistory;

function SessionCapsNotice({ reason }: { reason: string }) {
  return (
    <div className="flex gap-2 border-b bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
      <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
      <p className="text-left leading-snug">{reason}</p>
    </div>
  );
}

function SessionRow({
  info,
  active,
}: {
  info: ListedSession;
  active: boolean;
}) {
  return (
    <div className="min-w-0 w-full flex-row gap-2 py-0.5 text-left flex items-center">
      <IconCircleCheck
        className={cn(
          "size-3.5 shrink-0",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      />
      <span
        className={cn(
          "truncate font-medium flex-1",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {info.title?.trim() || info.sessionId}
      </span>
    </div>
  );
}

function SessionList({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { id: agentId, setting, setSessionId, caps } = useCurrentAgent();

  const [search, setSearch] = useState("");
  const [pageCursor, setPageCursor] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ListedSession[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const agentCapabilities = caps?.agentCapabilities;
  const canListSessions = agentCapabilities
    ? supportsSessionList(agentCapabilities)
    : true;

  const { data, isLoading, isFetching } = api.agent.sessions.useQuery(
    {
      agent: agentId,
      cursor: pageCursor,
    },
    {
      enabled: open && !!agentId && canListSessions,
      staleTime: 15_000,
    },
  );

  const canPersistSessions = agentCapabilities
    ? supportsPersistedSessions(agentCapabilities)
    : true;
  const notice = caps?.capabilityNotice;

  useEffect(() => {
    if (!open) {
      setPageCursor(null);
      setSessions([]);
      setNextCursor(null);
      setSearch("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !data || isFetching) return;
    if (pageCursor === null) {
      setSessions(data.sessions);
    } else {
      setSessions((prev) => [...prev, ...data.sessions]);
    }
    setNextCursor(data.nextCursor ?? null);
  }, [data, open, pageCursor, isFetching]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const title = (s.title || "").toLowerCase();
      return (
        title.includes(q) ||
        s.sessionId.toLowerCase().includes(q) ||
        s.cwd.toLowerCase().includes(q)
      );
    });
  }, [sessions, search]);

  const loadMore = () => {
    if (!isFetching && nextCursor) {
      setPageCursor(nextCursor);
    }
  };

  const showNotice = Boolean(
    notice || !canListSessions || !canPersistSessions,
  );

  return (
    <Command shouldFilter={false}>
      {showNotice && notice ? <SessionCapsNotice reason={notice} /> : null}
      <CommandInput
        placeholder={
          canListSessions ? "Search sessions…" : "Sessions unavailable"
        }
        value={search}
        onValueChange={setSearch}
        disabled={!canListSessions}
      />
      <CommandList className="pt-2">
        <CommandEmpty className="text-xs p-4 pb-2 text-center">
          {!canListSessions ? (
            <span className="text-muted-foreground">
              {notice ?? "This agent does not support session history."}
            </span>
          ) : isLoading ? (
            <span className="flex items-center w-full gap-2">
              <Spinner />
            </span>
          ) : (
            <span className="flex items-center w-full gap-2">
              <span>No matching sessions.</span>
            </span>
          )}
        </CommandEmpty>
        {canListSessions ? (
          <CommandGroup>
            {filtered.map((info) => (
              <CommandItem
                key={info.sessionId}
                value={info.sessionId}
                disabled={!canPersistSessions}
                onSelect={() => {
                  if (!canPersistSessions) return;
                  setSessionId(info.sessionId);
                  setOpen(false);
                }}
                className={cn(
                  "group/session w-full justify-between text-xs",
                  !canPersistSessions && "opacity-60",
                )}
              >
                <SessionRow
                  info={info}
                  active={info.sessionId === setting.id}
                />
              </CommandItem>
            ))}
            {!search && nextCursor ? (
              <CommandItem
                onSelect={loadMore}
                className="text-center text-muted-foreground text-xs justify-between"
                disabled={isFetching}
              >
                <span>{isFetching ? "Loading…" : "Load more"}</span>
                <span className="text-xs text-muted-foreground">→</span>
              </CommandItem>
            ) : null}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  );
}

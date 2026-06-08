"use client";

import { useCurrentAgent } from "@/hooks/use-agents";
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
import type { RegistryAgentFromRouter } from "@/hooks/use-agents";
import { IconCheck, IconSparkles } from "@tabler/icons-react";
import {
  memo,
  type PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from "react";

export const AgentPicker = memo(
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
            className="w-(--sidebar-width) rounded-none p-0 z-100"
            align="start"
            container={container?.current}
            collisionBoundary={container?.current}
          >
            <AgentPickerList open={open} setOpen={setOpen} />
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
            <AgentPickerList open={open} setOpen={setOpen} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  },
);

function AgentRow({ agent }: { agent: RegistryAgentFromRouter }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
      {agent.icon ? (
        <img
          src={agent.icon}
          alt={agent.name}
          className="size-4 shrink-0 dark:invert"
        />
      ) : (
        <IconSparkles className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate font-medium">{agent.name}</span>
      {!agent.available && (
        <span className="text-xs text-muted-foreground">Not available</span>
      )}
    </div>
  );
}

function AgentPickerList({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { agent: selected, agents, selectAgent } = useCurrentAgent();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return agents;
    return agents.filter(
      (a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q),
    );
  }, [agents, search]);

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search agents…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty className="text-xs p-4 pb-2 text-center">
          No agents match.
        </CommandEmpty>
        <CommandGroup>
          {filtered.map((a) => (
            <CommandItem
              key={a.id}
              value={a.id}
              onSelect={() => {
                selectAgent(a.id);
                setOpen(false);
              }}
              className="text-xs justify-between gap-2"
              disabled={!a.available}
            >
              <AgentRow agent={a} />
              {selected?.id === a.id ? (
                <IconCheck className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

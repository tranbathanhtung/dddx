"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconFolder,
  IconFolderPlus,
} from "@tabler/icons-react";
import { cn } from "../utils/cn";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type WorkspaceOption = {
  id: string;
  name: string;
  kind: "main" | "prototype";
};

export type WorkspaceSelectorProps = {
  workspaces: WorkspaceOption[];
  value?: string;
  onChange?: (workspaceId: string) => void;
  onCreate?: (name: string) => void;
  disabled?: boolean;
  /** Highlights the workspace the agent is currently writing to. */
  agentActiveId?: string | null;
  className?: string;
  variant?: "ghost" | "outline" | "secondary";
};

export const WorkspaceSelector = memo(function WorkspaceSelector({
  workspaces,
  value,
  onChange,
  onCreate,
  disabled,
  agentActiveId,
  className,
  variant = "ghost",
}: WorkspaceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const active =
    workspaces.find((w) => w.id === value) ??
    workspaces.find((w) => w.kind === "main") ??
    workspaces[0];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(q));
  }, [workspaces, search]);

  const handleSelect = useCallback(
    (id: string) => {
      onChange?.(id);
      setOpen(false);
    },
    [onChange],
  );

  const handleCreate = useCallback(() => {
    const name = window.prompt("Design name");
    if (!name?.trim()) return;
    onCreate?.(name.trim());
    setOpen(false);
  }, [onCreate]);

  if (!active) return null;

  const isAgentTarget = agentActiveId === active.id;

  const trigger = (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={disabled}
      className={cn(
        "h-7 max-w-full gap-1.5 rounded-full px-2.5 text-xs font-medium text-foreground/80",
        variant === "ghost"
          ? active.kind === "main"
            ? "text-orange-600 hover:text-orange-700"
            : "text-purple-600 hover:text-purple-700"
          : "",
        isAgentTarget &&
          "ring-2 ring-amber-400/80 ring-offset-2 ring-offset-background",
        className,
      )}
      aria-label="Select workspace"
      aria-expanded={open}
    >
      <IconFolder className="size-3.5 shrink-0" />
      <span className="truncate">{active.name}</span>
      {isAgentTarget ? (
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
        </span>
      ) : null}
      <IconChevronDown className="size-3 shrink-0 opacity-50" />
    </Button>
  );

  if (disabled) return trigger;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-64 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search workspaces"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-48">
            <CommandEmpty className="py-4 text-center text-xs">
              No workspaces match your search.
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  value={workspace.id}
                  onSelect={() => handleSelect(workspace.id)}
                  className="text-xs justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <IconFolder className="size-3.5 shrink-0 opacity-70" />
                    <span className="truncate font-medium">
                      {workspace.name}
                    </span>
                    {agentActiveId === workspace.id ? (
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        Working
                      </span>
                    ) : null}
                  </span>
                  {active.id === workspace.id ? (
                    <IconCheck className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreate && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__create_design__"
                    onSelect={handleCreate}
                    className="text-xs"
                  >
                    <IconFolderPlus className="size-3.5 shrink-0 opacity-70" />
                    <span>Add new design</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

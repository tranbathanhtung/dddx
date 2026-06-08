"use client";

import { memo, useCallback, useState } from "react";
import type { ComponentType } from "react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { cn } from "../utils/cn";
import { Popover } from "./popover";
import { Button } from "@/components/ui/button";

export type ModeOption = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  description?: string;
};

export type ModeSelectorProps = {
  modes: ModeOption[];
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onChange?: (modeId: string) => void;
  className?: string;
};

export const ModeSelector = memo(function ModeSelector({
  modes,
  value,
  defaultValue,
  disabled,
  onChange,
  className,
}: ModeSelectorProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeId = isControlled ? value : internalValue;
  const activeMode = modes.find((m) => m.id === activeId) ?? modes[0];
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (id: string) => {
      if (!isControlled) setInternalValue(id);
      onChange?.(id);
      setOpen(false);
    },
    [isControlled, onChange],
  );

  if (modes.length === 0) return null;
  const ActiveIcon = activeMode?.icon;
  const hasMultiple = modes.length > 1;

  const trigger = (
    <Button
      type="button"
      className={cn(
        "text-foreground/60 shadow-none",
        !hasMultiple && "pointer-events-none",
        className,
      )}
      variant="secondary"
      aria-label="Select mode"
      size="xs"
      disabled={disabled}
    >
      {ActiveIcon && <ActiveIcon className="size-3.5 shrink-0" />}
      <span className="font-medium">{activeMode?.label}</span>
      {hasMultiple && <IconChevronDown className="size-3 text-current" />}
    </Button>
  );

  if (!hasMultiple) return trigger;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="top"
      align="start"
      trigger={trigger}
      className="max-w-64"
    >
      {modes.map((mode) => {
        const isActive = mode.id === activeMode?.id;
        const Icon = mode.icon;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => handleSelect(mode.id)}
            className={cn(
              "flex w-full items-start gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] leading-4 text-an-foreground transition-colors hover:bg-foreground/6 cursor-pointer",
              isActive && "bg-foreground/6",
            )}
          >
            {Icon && <Icon className="mt-0.5 size-3.5 shrink-0" />}
            <span className="flex-1 min-w-0">
              <span className="block truncate font-medium">{mode.label}</span>
              {mode.description && (
                <span className="block truncate text-foreground/40">
                  {mode.description}
                </span>
              )}
            </span>
            {isActive && (
              <IconCheck className="mt-0.5 size-3.5 shrink-0 text-foreground/60" />
            )}
          </button>
        );
      })}
    </Popover>
  );
});

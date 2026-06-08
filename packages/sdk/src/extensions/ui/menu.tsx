import { memo } from "react";
import { IconBlocks } from "@tabler/icons-react";

import { useActive } from "../active";
import { click } from "../bridge";
import { get, list } from "../registry";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const ActiveButtons = memo(function ActiveButtons() {
  const { activeIds } = useActive();

  if (activeIds.length === 0) return null;

  return (
    <>
      {activeIds.map((id) => {
        const ext = get(id);
        if (!ext) return null;
        const Logo = ext.logo;
        return (
          <Button
            key={id}
            aria-label={`Open ${ext.name}`}
            aria-pressed
            size="icon-sm"
            variant="ghost"
            className="text-foreground"
            onClick={() => void click(id)}
          >
            <Logo className="size-4 rounded" />
          </Button>
        );
      })}
    </>
  );
});

export const ExtMenu = memo(function ExtMenu() {
  const { active, toggle } = useActive();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Preview extensions" size="icon-sm" variant="ghost">
          <IconBlocks />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Extensions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {list.map((ext) => {
          const Logo = ext.logo;
          const checked = active.has(ext.id);
          return (
            <DropdownMenuCheckboxItem
              key={ext.id}
              checked={checked}
              className="gap-2"
              onCheckedChange={() => toggle(ext.id)}
            >
              <Logo
                className={cn(
                  "size-4 shrink-0 rounded",
                  checked ? "text-foreground" : "text-muted-foreground",
                )}
              />
              <span className="flex-1">{ext.name}</span>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

/** @deprecated Use {@link ActiveButtons} */
export const ActiveExtensionButtons = ActiveButtons;

/** @deprecated Use {@link ExtMenu} */
export const ExtensionsMenu = ExtMenu;

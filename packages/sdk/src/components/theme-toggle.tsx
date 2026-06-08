import { IconMoon, IconSun } from "@tabler/icons-react";
import { Button } from "./ui/button";
import type { Theme } from "@/store";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
  className?: string;
}

export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  const isDark = theme === "dark";
  return (
    <Button
      variant="secondary"
      size="icon-sm"
      className={`rounded-full ${className ?? ""}`.trim()}
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <IconSun className="size-3" /> : <IconMoon className="size-3" />}
    </Button>
  );
}

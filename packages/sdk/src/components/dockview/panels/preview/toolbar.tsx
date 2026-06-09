import {
  IconArrowLeft,
  IconArrowRight,
  IconCamera,
  IconDeviceDesktop,
  IconMessagePlus,
  IconRefresh,
  IconServer,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UrlBar } from "./url-bar";

export function Toolbar({
  url,
  status,
  device,
  annotate,
  devReady,
  capturing,
  canBack,
  canForward,
  onBack,
  onFwd,
  onRefresh,
  onGo,
  onOpen,
  onShowLocal,
  onAnnotate,
  onShot,
  onDevice,
}: {
  url: string;
  status: "loading" | "error" | "ready";
  device: "desktop" | "mobile";
  annotate: boolean;
  devReady: boolean;
  capturing: boolean;
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onFwd: () => void;
  onRefresh: () => void;
  onGo: (url: string) => void;
  onOpen: () => void;
  onShowLocal?: () => void;
  onAnnotate: () => void;
  onShot: () => void;
  onDevice: () => void;
}) {
  return (
    <div className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b px-2 text-muted-foreground">
      <div className="flex items-center gap-0.5">
        <Button
          aria-label="Go back"
          size="icon-sm"
          variant="ghost"
          disabled={!canBack}
          onClick={onBack}
        >
          <IconArrowLeft />
        </Button>
        <Button
          aria-label="Go forward"
          size="icon-sm"
          variant="ghost"
          disabled={!canForward}
          onClick={onFwd}
        >
          <IconArrowRight />
        </Button>
        <Button
          aria-label="Refresh preview"
          size="icon-sm"
          variant="ghost"
          onClick={onRefresh}
        >
          <IconRefresh />
        </Button>
      </div>

      <UrlBar url={url} onGo={onGo} onOpen={onOpen} />

      <div className="flex items-center justify-end gap-1">
        {onShowLocal ? (
          <Button
            aria-label="Choose local app"
            size="icon-sm"
            variant="ghost"
            onClick={onShowLocal}
          >
            <IconServer />
          </Button>
        ) : null}
        <Button
          aria-label={annotate ? "Stop annotating (Esc)" : "Start annotating"}
          aria-pressed={annotate}
          size="sm"
          variant="ghost"
          disabled={!devReady}
          className={cn(
            "h-7 min-w-7 overflow-hidden px-0 transition-[width,gap,padding,background-color,color,box-shadow] duration-300 ease-out",
            annotate
              ? "gap-1.5 px-2.5 bg-sky-100 text-sky-700 shadow-none hover:bg-sky-100 hover:text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-950/60 dark:hover:text-sky-300"
              : "w-7 hover:bg-muted",
          )}
          onClick={onAnnotate}
        >
          <IconMessagePlus
            className={cn(
              "size-4 shrink-0 transition-transform duration-300 ease-out",
              annotate && "scale-110",
            )}
          />
          <span
            aria-hidden={!annotate}
            className={cn(
              "overflow-hidden whitespace-nowrap text-xs font-medium transition-all duration-300 ease-out",
              annotate
                ? "max-w-24 translate-x-0 opacity-100"
                : "max-w-0 -translate-x-1 opacity-0",
            )}
          >
            Annotating
          </span>
        </Button>

        <Button
          aria-label="Screenshot page to context"
          size="icon-sm"
          variant="ghost"
          disabled={!devReady || capturing || status !== "ready"}
          onClick={onShot}
        >
          <IconCamera className={cn(capturing && "animate-pulse")} />
        </Button>

        <Button
          aria-label="Toggle device width"
          size="icon-sm"
          variant="ghost"
          onClick={onDevice}
        >
          <IconDeviceDesktop />
        </Button>
      </div>
    </div>
  );
}

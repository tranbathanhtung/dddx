import { useEffect, useRef, useState } from "react";

import { studioProjectSlug } from "@/lib/project-path";
import { useLatest } from "./use-latest";

function eventUrl(id: string): string {
  const base = window.dddx?.url ?? "";
  const slug = studioProjectSlug();
  if (!slug) return `${base}/event?workspace=${encodeURIComponent(id)}`;
  return `${base}/p/${encodeURIComponent(slug)}/event?workspace=${encodeURIComponent(id)}`;
}

export interface UseDesignFileEventsOptions {
  enabled: boolean;
  id: string | undefined;
  onFilesChanged: () => void;
  onFileEvent?: (event: {
    path: string;
    type: "add" | "change" | "unlink";
  }) => void;
  /** Fired when the agent finishes a write burst (`file.watcher.ended`). */
  onWatcherEnded?: () => void;
  debounceMs?: number;
  /**
   * After `enabled` turns off, keep the SSE connection open this long so
   * `file.watcher.ended` can arrive (chat stream ends before server release).
   */
  drainMs?: number;
}

/**
 * Subscribe to studio SSE file events for a single design workspace.
 * Debounces refetches so rapid agent writes collapse into one canvas update.
 *
 * Returns whether the EventSource is currently open (including the post-stream
 * drain window while waiting for `file.watcher.ended`).
 */
export function useDesignFileEvents({
  enabled,
  id,
  onFilesChanged,
  onFileEvent,
  onWatcherEnded,
  debounceMs = 300,
  drainMs = 8_000,
}: UseDesignFileEventsOptions): boolean {
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceRef = useRef<string | undefined>(id);

  const onChangeRef = useLatest(onFilesChanged);
  const onFileEventRef = useLatest(onFileEvent);
  const onWatcherEndedRef = useLatest(onWatcherEnded);

  useEffect(() => {
    const clearDebounce = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };

    const clearDrain = () => {
      if (drainRef.current) clearTimeout(drainRef.current);
      drainRef.current = null;
    };

    const close = () => {
      clearDebounce();
      esRef.current?.close();
      esRef.current = null;
      setConnected(false);
    };

    const finishBurst = () => {
      clearDrain();
      onWatcherEndedRef.current?.();
      onChangeRef.current();
      close();
    };

    const scheduleRefetch = () => {
      clearDebounce();
      debounceRef.current = setTimeout(() => onChangeRef.current(), debounceMs);
    };

    const attach = (workspaceId: string) => {
      if (esRef.current) return;

      const es = new EventSource(eventUrl(workspaceId));
      esRef.current = es;
      setConnected(true);

      es.onmessage = (message) => {
        let data: { type?: string };
        try {
          data = JSON.parse(message.data) as typeof data;
        } catch {
          return;
        }

        if (data.type === "file.watcher.updated") {
          const properties = (
            data as { properties?: { path?: string; event?: string } }
          ).properties;
          const path = properties?.path;
          const fileEvent = properties?.event;
          if (
            path &&
            (fileEvent === "add" ||
              fileEvent === "change" ||
              fileEvent === "unlink")
          ) {
            onFileEventRef.current?.({ path, type: fileEvent });
          }
          scheduleRefetch();
          return;
        }

        if (data.type === "file.watcher.ended") {
          finishBurst();
        }
      };
    };

    if (!id) {
      clearDrain();
      close();
      workspaceRef.current = undefined;
      return;
    }

    if (workspaceRef.current !== id) {
      clearDrain();
      close();
      workspaceRef.current = id;
    }

    if (enabled) {
      clearDrain();
      attach(id);
    } else if (esRef.current && !drainRef.current) {
      drainRef.current = setTimeout(finishBurst, drainMs);
    }
  }, [enabled, id, debounceMs, drainMs]);

  useEffect(
    () => () => {
      if (drainRef.current) clearTimeout(drainRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      esRef.current?.close();
      esRef.current = null;
      setConnected(false);
    },
    [],
  );

  return connected;
}

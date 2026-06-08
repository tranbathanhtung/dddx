"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { IconArrowUpRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { normUrl } from "./url";

function displayUrl(url: string) {
  if (!url) return "Enter a URL";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

export const UrlBar = memo(function UrlBar({
  url,
  onGo,
  onOpen,
}: {
  url: string;
  onGo: (url: string) => void;
  onOpen: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(url);
  const inputRef = useRef<HTMLInputElement>(null);
  const label = useMemo(() => displayUrl(url), [url]);

  useEffect(() => {
    if (!edit) setDraft(url);
  }, [url, edit]);

  useEffect(() => {
    if (edit) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [edit]);

  const commit = () => {
    const next = normUrl(draft);
    if (!next) {
      setDraft(url);
      setEdit(false);
      return;
    }
    setEdit(false);
    onGo(next);
  };

  return (
    <div
      className={cn(
        "relative group h-7 max-w-[40vw] overflow-hidden rounded-full border transition-[min-width,background-color,border-color,box-shadow] duration-200 ease-out",
        edit
          ? "min-w-64 border-transparent bg-muted/40 shadow-button"
          : "min-w-32 border-transparent bg-transparent hover:border-border hover:bg-muted/50",
      )}
    >
      <div className="grid h-7 *:col-start-1 *:row-start-1">
        <button
          type="button"
          aria-label="Edit preview URL"
          aria-hidden={edit}
          tabIndex={edit ? -1 : 0}
          onClick={() => setEdit(true)}
          className={cn(
            "flex h-7 items-center truncate px-3 text-center text-sm text-foreground transition-[opacity,transform] duration-200 ease-out",
            edit
              ? "pointer-events-none scale-[0.98] opacity-0"
              : "scale-100 opacity-100",
          )}
        >
          {label}
        </button>

        <div
          aria-hidden={!edit}
          className={cn(
            "flex h-7 items-center gap-1 pl-2 pr-0 transition-[opacity,transform] duration-200 ease-out",
            edit
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-[0.98] opacity-0",
          )}
        >
          <input
            ref={inputRef}
            aria-label="Preview URL"
            tabIndex={edit ? 0 : -1}
            className="min-w-0 flex-1 bg-transparent text-sm leading-none text-foreground outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setDraft(url);
                setEdit(false);
              }
            }}
            onBlur={commit}
          />
          <button
            type="button"
            aria-label="Open preview in new tab"
            className={cn(
              "inline-flex size-6 -mt-0.5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[opacity,transform,background-color,color] duration-200 ease-out hover:bg-muted hover:text-foreground group-hover:opacity-100 group-hover:translate-x-0",
              edit ? "translate-x-0 opacity-100" : "translate-x-1 opacity-0",
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpen}
          >
            <IconArrowUpRight className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
});

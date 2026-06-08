import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { api } from "@/client";
import type { Tool } from "./toolbar";
import { fileToBase64 } from "./upload";

function isTyping(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

type Options = {
  onEscape?: () => void;
  workspaceId?: string;
  uploadBlocked?: boolean;
  onUploaded?: () => void;
};

export function useTools({
  onEscape,
  workspaceId,
  uploadBlocked,
  onUploaded,
}: Options = {}) {
  const [tool, setTool] = useState<Tool>("select");
  const [space, setSpace] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = api.project.designs.upload.useMutation({
    onSuccess: () => onUploaded?.(),
  });

  const uploadOff =
    !workspaceId || !!uploadBlocked || upload.isPending;

  const onUpload = useCallback(() => {
    if (!workspaceId || uploadBlocked) return;
    inputRef.current?.click();
  }, [workspaceId, uploadBlocked]);

  const onUploadChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.currentTarget.files;
      if (!selected?.length || !workspaceId) return;
      void (async () => {
        const files = await Promise.all(
          Array.from(selected).map(async (file) => ({
            path: file.name,
            contentBase64: await fileToBase64(file),
          })),
        );
        await upload.mutateAsync({ id: workspaceId, files });
        event.currentTarget.value = "";
      })();
    },
    [workspaceId, upload],
  );

  const isPan = (space ? "pan" : tool) === "pan";

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpace(true);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "v" || e.key === "V") setTool("select");
      else if (e.key === "h" || e.key === "H") setTool("pan");
      else if (e.key === "Escape") onEscape?.();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [onEscape]);

  return {
    tool,
    setTool,
    isPan,
    uploadInputRef: inputRef,
    onUpload,
    onUploadChange,
    uploadOff,
  };
}

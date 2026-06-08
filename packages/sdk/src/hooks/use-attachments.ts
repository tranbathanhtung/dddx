import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePromptContext } from "@/components/prompt-context-provider";
import type {
  AttachedCustomContext,
  AttachedFile,
  AttachedImage,
} from "@/components/agent-elements/input-bar";

const isAttachedImage = (context: {
  id: string;
  filename?: string;
  url?: string;
}): context is AttachedImage =>
  typeof context.filename === "string" && typeof context.url === "string";

const isAttachedFile = (context: {
  id: string;
  filename?: string;
  url?: string;
}): context is AttachedFile =>
  typeof context.filename === "string" && typeof context.url !== "string";

const isAttachedCustomContext = (context: {
  id: string;
  value?: string;
  name?: string;
}): context is AttachedCustomContext =>
  typeof context.value === "string" && typeof context.name === "string";

const isImageFile = (file: File) => file.type.startsWith("image/");

export function useAttachments() {
  const [localImages, setLocalImages] = useState<AttachedImage[]>([]);
  const [localFiles, setLocalFiles] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const { customContexts, setCustomContexts } = usePromptContext();

  const contextImages = useMemo(
    () => customContexts.filter((context) => isAttachedImage(context)),
    [customContexts],
  );
  const contextFiles = useMemo(
    () => customContexts.filter((context) => isAttachedFile(context)),
    [customContexts],
  );
  const mergedImages = useMemo(
    () => [...localImages, ...contextImages],
    [localImages, contextImages],
  );
  const mergedFiles = useMemo(
    () => [...localFiles, ...contextFiles],
    [localFiles, contextFiles],
  );
  const mergedCustomContexts = useMemo(
    () => customContexts.filter((context) => isAttachedCustomContext(context)),
    [customContexts],
  );

  const addFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) {
      return;
    }

    const nextImages: AttachedImage[] = [];
    const nextFiles: AttachedFile[] = [];

    for (const file of incoming) {
      const id = crypto.randomUUID();
      if (isImageFile(file)) {
        const url = URL.createObjectURL(file);
        objectUrlsRef.current.push(url);
        nextImages.push({
          id,
          filename: file.name,
          size: file.size,
          url,
        });
        continue;
      }

      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      nextFiles.push({
        id,
        filename: file.name,
        size: file.size,
        url,
      });
    }

    if (nextImages.length > 0) {
      setLocalImages((prev) => [...prev, ...nextImages]);
    }
    if (nextFiles.length > 0) {
      setLocalFiles((prev) => [...prev, ...nextFiles]);
    }
  }, []);

  const onAttach = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.currentTarget.files;
      if (!selected || selected.length === 0) {
        return;
      }
      addFiles(Array.from(selected));
      // Allow picking the same file again after removal.
      event.currentTarget.value = "";
    },
    [addFiles],
  );

  const onRemoveImage = useCallback((id: string) => {
    setLocalImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target?.url) {
        URL.revokeObjectURL(target.url);
        objectUrlsRef.current = objectUrlsRef.current.filter(
          (url) => url !== target.url,
        );
      }
      return prev.filter((image) => image.id !== id);
    });
    setCustomContexts((prev) => prev.filter((context) => context.id !== id));
  }, [setCustomContexts]);

  const onRemoveFile = useCallback(
    (id: string) => {
      setLocalFiles((prev) => {
        const target = prev.find((file) => file.id === id);
        if (target?.url) {
          URL.revokeObjectURL(target.url);
          objectUrlsRef.current = objectUrlsRef.current.filter(
            (url) => url !== target.url,
          );
        }
        return prev.filter((file) => file.id !== id);
      });
      setCustomContexts((prev) => prev.filter((context) => context.id !== id));
    },
    [setCustomContexts],
  );

  const clearStaged = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
    setLocalImages([]);
    setLocalFiles([]);
    setCustomContexts([]);
  }, [setCustomContexts]);

  const onRemoveCustomContext = useCallback(
    (id: string) => {
      setCustomContexts((prev) => prev.filter((context) => context.id !== id));
    },
    [setCustomContexts],
  );

  const onPaste = useCallback(
    (event: React.ClipboardEvent) => {
      const clipboardFiles = Array.from(event.clipboardData.files ?? []);
      if (clipboardFiles.length === 0) {
        return;
      }
      event.preventDefault();
      addFiles(clipboardFiles);
    },
    [addFiles],
  );

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) {
        event.preventDefault();
        setIsDragOver(true);
      }
    };

    const onDragLeave = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) {
        setIsDragOver(false);
      }
    };

    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) {
        return;
      }
      event.preventDefault();
      setIsDragOver(false);
      addFiles(Array.from(event.dataTransfer.files));
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  useEffect(
    () => () => {
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current = [];
    },
    [],
  );

  return {
    customContexts: mergedCustomContexts,
    files: mergedFiles,
    images: mergedImages,
    inputRef,
    isDragOver,
    onAttach,
    onFileInputChange,
    onPaste,
    onRemoveCustomContext,
    onRemoveFile,
    onRemoveImage,
    clearStaged,
  };
}

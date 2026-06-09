import { memo, useState } from "react";
import type { UIMessage } from "ai";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "./utils/cn";
import { FileAttachment } from "./input/file-attachment";
import { ImageLightbox } from "./image-lightbox";
import {
  isSystemReminderOnlyPart,
  stripStudioInjectionsFromText,
} from "@/lib/message-context";

const COLLAPSE_THRESHOLD = 300;

export type UserMessageProps = {
  message: UIMessage;
  className?: string;
  /**
   * When true (default) clicking an attached image opens a fullscreen
   * lightbox preview. Set to false to render images as plain thumbnails.
   */
  enableImagePreview?: boolean;
};

type MessagePart = UIMessage["parts"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTextPart(part: MessagePart): part is { type: "text"; text: string } {
  return (
    part.type === "text" &&
    typeof (part as { text?: unknown }).text === "string"
  );
}

function getImageUrlFromPart(part: unknown): string | null {
  if (!isRecord(part)) return null;
  const type = part.type;
  if (typeof type !== "string") return null;

  if (type === "image") {
    const imagePart = part as { url?: string; image?: string };
    return imagePart.url ?? imagePart.image ?? null;
  }

  if (type === "data-image") {
    const dataPart = part as { data?: { url?: string } };
    return dataPart.data?.url ?? null;
  }

  if (type === "file") {
    const filePart = part as {
      mediaType?: string;
      mimeType?: string;
      url?: string;
      data?: string;
    };
    const mediaType = filePart.mediaType ?? filePart.mimeType;
    if (mediaType?.startsWith("image/")) {
      if (filePart.url) return filePart.url;
      if (filePart.data) {
        return `data:${mediaType};base64,${filePart.data}`;
      }
    }
  }

  return null;
}

type FilePart = {
  type: "file";
  filename?: string;
  name?: string;
  fileName?: string;
  size?: number;
  mediaType?: string;
  mimeType?: string;
  url?: string;
};

function getFileFromPart(part: unknown) {
  if (!isRecord(part)) return null;
  if (part.type !== "file") return null;
  const filePart = part as FilePart;
  const filename =
    filePart.filename || filePart.name || filePart.fileName || "Attachment";
  const mediaType = filePart.mediaType ?? filePart.mimeType;
  const isImage = mediaType?.startsWith("image/") ?? false;
  if (isImage) return null;
  return {
    filename,
    size: filePart.size,
  };
}

type CollapsibleTextProps = {
  text: string;
  isExpanded: boolean;
  onToggle: () => void;
  prefersReducedMotion: boolean;
};

function CollapsibleText({
  text,
  isExpanded,
  onToggle,
  prefersReducedMotion,
}: CollapsibleTextProps) {
  const isLong = text.length > COLLAPSE_THRESHOLD;
  const displayText =
    isLong && !isExpanded ? text.slice(0, COLLAPSE_THRESHOLD) : text;

  const bubbleClass =
    "px-3.5 py-1.5 text-sm transition-colors rounded-an-message bg-an-user-message-bg text-an-user-message-text";

  const content = (
    <>
      <p className="leading-5 whitespace-pre-wrap wrap-break-word">
        {displayText}
        {isLong && !isExpanded && (
          <span className="opacity-50">…</span>
        )}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1.5 text-xs font-medium opacity-60 hover:opacity-100 transition-opacity cursor-pointer bg-transparent border-0 p-0 text-inherit"
        >
          {isExpanded ? "Show less" : `Show more · ${text.length.toLocaleString()} chars`}
        </button>
      )}
    </>
  );

  if (prefersReducedMotion) {
    return <div className={bubbleClass}>{content}</div>;
  }

  return (
    <motion.div
      className={bubbleClass}
      style={{ WebkitTapHighlightColor: "transparent" }}
      whileTap={{ scale: 0.97 }}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={isExpanded ? "expanded" : "collapsed"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

export const UserMessage = memo(function UserMessage({
  message,
  className,
  enableImagePreview = true,
}: UserMessageProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const images: string[] = [];
  const files: Array<{ filename: string; size?: number }> = [];
  const userTextLines: string[] = [];

  for (const part of message.parts ?? []) {
    const imageUrl = getImageUrlFromPart(part);
    if (imageUrl) images.push(imageUrl);
    const file = getFileFromPart(part);
    if (file) files.push(file);
  }

  for (const part of message.parts?.filter(isTextPart) ?? []) {
    if (isSystemReminderOnlyPart(part.text)) continue;

    const line = stripStudioInjectionsFromText(part.text);
    if (line) userTextLines.push(line);
  }

  const text = userTextLines.join("\n\n");

  if (isRecord(message) && Array.isArray(message.experimental_attachments)) {
    for (const att of message.experimental_attachments as Array<{
      contentType?: string;
      url?: string;
    }>) {
      if (att.contentType?.startsWith("image/") && att.url) {
        images.push(att.url);
      }
    }
  }

  if (!text && images.length === 0 && files.length === 0) {
    return null;
  }

  const lightboxImages = images.map((url, i) => ({
    id: `${message.id}-img-${i}`,
    url,
    filename: `image-${i + 1}`,
  }));

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      {images.length > 0 &&
        images.map((url, i) =>
          enableImagePreview ? (
            <button
              key={i}
              type="button"
              className="max-w-[200px] p-1.5 bg-an-foreground/4 rounded-an-message cursor-pointer border-0 text-left"
              aria-label={`Open image ${i + 1} preview`}
              onClick={() => setLightboxIndex(i)}
            >
              <img
                src={url}
                alt=""
                className="block object-cover max-w-[184px] max-h-[120px] rounded-an-message-inner pointer-events-none"
              />
            </button>
          ) : (
            <div
              key={i}
              className="max-w-[200px] p-1.5 bg-an-foreground/4 rounded-an-message"
            >
              <img
                src={url}
                alt="attachment"
                className="block object-cover max-w-[184px] max-h-[120px] rounded-an-message-inner"
              />
            </div>
          ),
        )}
      {enableImagePreview && lightboxImages.length > 0 && (
        <ImageLightbox
          open={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          images={lightboxImages}
          initialIndex={lightboxIndex ?? 0}
        />
      )}
      {files.length > 0 && (
        <div className="flex flex-col items-end gap-2">
          {files.map((file, i) => (
            <FileAttachment
              key={`${file.filename}-${i}`}
              id={`${file.filename}-${i}`}
              filename={file.filename}
              size={file.size}
            />
          ))}
        </div>
      )}
      {text && (
        <div className="max-w-[calc(95%-40px)] ms-[70px]">
          <CollapsibleText
            text={text}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded((prev) => !prev)}
            prefersReducedMotion={!!prefersReducedMotion}
          />
        </div>
      )}
    </div>
  );
});

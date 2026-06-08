import React, {
  memo,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useState,
  useMemo,
} from "react";
import type { UIMessage, ChatStatus } from "ai";
import { cn } from "./utils/cn";

import { UserMessage } from "./user-message";
import { Markdown } from "./markdown";
import { ErrorMessage } from "./error-message";
import type { CustomToolRendererProps } from "./types";
import { ToolRowBase } from "./tools/tool-row-base";
import { IconCopy, IconCheck, IconArrowDown } from "@tabler/icons-react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import type { StickToBottomContext } from "use-stick-to-bottom";
import { ToolRenderer as DefaultToolRenderer } from "./tools/tool-renderer";
import { normalizeAssistantToolParts } from "./utils/tool-part-normalizer";
import { SpiralLoader } from "./spiral-loader";
import { ThinkingTool } from "./tools/thinking-tool";
import { AnimatedMessageEnter } from "./message-motion";
import { playReceiveSound } from "./utils/imessage-sounds";
import { isQuestionsV2ToolPart } from "./question/questions-v2";

export type MessageListProps = {
  messages: UIMessage[];
  status: ChatStatus;
  className?: string;
  showCopyToolbar?: boolean;
  suppressQuestionTool?: boolean;
  /**
   * Where to position the scroll container on initial mount.
   * - "bottom" (default): classic chat behavior, pinned to the latest message.
   * - "top": start from the top of the conversation — useful for static demos
   *   or read-only transcripts where the user should read top-to-bottom.
   */
  initialScrollBehavior?: "bottom" | "top";
  /**
   * When true (default) clicking an attached image in a user message opens
   * the fullscreen lightbox preview. Set to false to disable previews.
   */
  enableImagePreview?: boolean;
  /**
   * How to seed the enter-animation baseline on first mount.
   * - `capture-initial` (default): messages already in the list do not animate.
   * - `none`: animate every message present when the list first appears
   *   (e.g. first send from a centered empty state).
   */
  enterAnimationBaseline?: "capture-initial" | "none";
  slots?: {
    UserMessage?: React.ComponentType<{
      message: UIMessage;
      className?: string;
      enableImagePreview?: boolean;
    }>;
    ToolRenderer?: React.ComponentType<ToolRendererProps>;
  };
  classNames?: {
    userMessage?: string;
  };
  toolRenderers?: Record<string, React.ComponentType<CustomToolRendererProps>>;
};

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
type ToolPartBase = {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  result?: unknown;
};

type ToolRendererProps = {
  part: ToolPartBase;
  nestedTools?: ToolPartBase[];
  chatStatus?: string;
  toolRenderers?: Record<string, React.ComponentType<CustomToolRendererProps>>;
};

function normalizeMessages(messages: UIMessage[]): UIMessage[] {
  let changed = false;
  const normalized = messages.map((message) => {
    if (Array.isArray(message.parts) && message.parts.length > 0)
      return message;
    const raw = message as { content?: string; text?: string };
    const content = raw.content ?? raw.text;
    if (typeof content !== "string" || !content) return message;
    changed = true;
    return {
      ...message,
      parts: [{ type: "text", text: content }],
    } as UIMessage;
  });
  return changed ? normalized : messages;
}

const TOOL_ACTIVITY_LABEL_RE = /^Running .+…$/u;

function isToolActivityReasoningText(text: string): boolean {
  return TOOL_ACTIVITY_LABEL_RE.test(text.trim());
}

/** Label emitted while a provider tool runs (see spawn-agent-language-model). */
function getToolActivityLabel(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    const parts = msg.parts ?? [];
    for (let p = parts.length - 1; p >= 0; p -= 1) {
      const part = parts[p];
      if (isReasoningPart(part) && isToolActivityReasoningText(part.text)) {
        return part.text.trim();
      }
    }
    return null;
  }
  return null;
}

function isToolActivityInProgress(
  messages: UIMessage[],
  isStreaming: boolean,
): boolean {
  if (!isStreaming) return false;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    const parts = msg.parts ?? [];
    for (let p = parts.length - 1; p >= 0; p -= 1) {
      const part = parts[p];
      if (!isReasoningPart(part) || !isToolActivityReasoningText(part.text)) {
        continue;
      }
      return part.state === "streaming" || part.state === undefined;
    }
    return false;
  }
  return false;
}

function getLastAssistantHasVisibleContent(messages: UIMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    const parts = normalizeAssistantToolParts(msg.parts ?? []) as unknown[];
    for (const part of parts) {
      if (isTextPart(part) && part.text.trim().length > 0) return true;
      if (
        isReasoningPart(part) &&
        part.text.trim().length > 0 &&
        !isToolActivityReasoningText(part.text)
      ) {
        return true;
      }
      if (isV5ToolPart(part)) return true;
      if (isErrorPart(part)) return true;
    }
    return false;
  }
  return false;
}

/** True while text, reasoning, or tools are still streaming in the latest assistant turn. */
function getLastAssistantHasActiveContent(messages: UIMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    const parts = normalizeAssistantToolParts(msg.parts ?? []) as unknown[];
    for (const part of parts) {
      if (isTextPart(part) && part.text.trim().length > 0) {
        const state = (part as { state?: string }).state;
        if (state === "streaming") return true;
      }
      if (isReasoningPart(part) && part.text.trim().length > 0) {
        if (isToolActivityReasoningText(part.text)) continue;
        if (part.state === "streaming" || part.state === undefined) {
          return true;
        }
      }
      if (isV5ToolPart(part) && part.state === "input-streaming") {
        return true;
      }
    }
    return false;
  }
  return false;
}

function getLastUserMessageId(messages: UIMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role === "user") return msg.id;
  }
  return null;
}

function getLastAssistantMessageId(messages: UIMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role === "assistant") return msg.id;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTextPart(part: unknown): part is { type: "text"; text: string } {
  return (
    isRecord(part) && part.type === "text" && typeof part.text === "string"
  );
}

function isReasoningPart(
  part: unknown,
): part is { type: "reasoning"; text: string; state?: string } {
  return (
    isRecord(part) && part.type === "reasoning" && typeof part.text === "string"
  );
}

function isErrorPart(
  part: unknown,
): part is { type: "error"; title?: string; message: string } {
  return (
    isRecord(part) && part.type === "error" && typeof part.message === "string"
  );
}

function isV5ToolPart(part: unknown): part is ToolPartBase {
  if (!isRecord(part)) return false;
  const partType = part.type;
  return (
    partType === "dynamic-tool" ||
    (typeof partType === "string" && partType.startsWith("tool-"))
  );
}

function getTextFromParts(parts: unknown[], joiner: string): string {
  return parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join(joiner);
}

/** Lightweight fingerprint so memoized rows skip re-render when parts are referentially new but unchanged. */
function partsFingerprint(parts: unknown[] | undefined): string {
  if (!parts?.length) return "";
  return parts
    .map((part) => {
      if (!isRecord(part)) return "";
      const type = String(part.type ?? "");
      if (type === "text" || type === "reasoning") {
        const text = typeof part.text === "string" ? part.text : "";
        return `${type}:${text.length}:${String(part.state ?? "")}`;
      }
      return `${type}:${String(part.toolCallId ?? "")}:${String(part.state ?? "")}`;
    })
    .join("|");
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isSameDay) {
    return timeFormatter.format(date);
  }
  return dateFormatter.format(date);
}

function CopyButton({
  text,
  onCopied,
}: {
  text: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    if (copiedTimerRef.current) {
      window.clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = null;
    }, 2000);
    onCopied?.();
  };
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={handleCopy}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      className={cn(
        "size-6 flex items-center justify-center rounded-md active:scale-[0.97] transition-[background-color,opacity,transform] duration-150 ease-out",
        "opacity-50 bg-transparent hover:opacity-100 hover:bg-an-foreground/10",
      )}
    >
      <div className="relative w-3.5 h-3.5">
        <IconCopy
          className={cn(
            "absolute inset-0 w-3.5 h-3.5 text-an-foreground-muted transition-[opacity,transform] duration-150 ease-out",
            copied ? "opacity-0 scale-50" : "opacity-100 scale-100",
          )}
        />
        <IconCheck
          className={cn(
            "absolute inset-0 w-3.5 h-3.5 text-an-foreground-muted transition-[opacity,transform] duration-150 ease-out",
            copied ? "opacity-100 scale-100" : "opacity-0 scale-50",
          )}
        />
      </div>
    </button>
  );
}

function MessageToolbar({
  text,
  timestamp,
  heightClass,
  hoverClass,
  isVisible,
  alignClass,
  onCopied,
}: {
  text?: string;
  timestamp?: string;
  heightClass: string;
  hoverClass: string;
  isVisible: boolean;
  alignClass: string;
  onCopied?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 pt-1 text-xs text-an-foreground-muted/70 opacity-0 transition-opacity duration-100 pointer-events-none",
        heightClass,
        alignClass,
        hoverClass,
        isVisible && "opacity-100 pointer-events-auto",
      )}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {timestamp && <span>{timestamp}</span>}
      {text && <CopyButton text={text} onCopied={onCopied} />}
    </div>
  );
}

/** Syncs `--chat-container-height` on the scroll viewport (used by layout CSS). */
function MessageListScrollHeightVar() {
  const { scrollRef } = useStickToBottomContext();

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sync = () => {
      el.style.setProperty("--chat-container-height", `${el.clientHeight}px`);
    };
    sync();
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      el.style.setProperty("--chat-container-height", `${h}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);

  return null;
}

function InitialScrollToTop() {
  const { scrollRef } = useStickToBottomContext();
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [scrollRef]);
  return null;
}

function JumpToLatestMessages() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
      <button
        type="button"
        aria-label="Jump to latest messages"
        className={cn(
          "pointer-events-auto size-7 flex items-center justify-center rounded-full border border-border/80 bg-background/95 text-xs font-medium text-muted-foreground shadow-md backdrop-blur-sm",
          "hover:bg-accent hover:text-foreground",
        )}
        onClick={() => {
          void scrollToBottom({ animation: "smooth" });
        }}
      >
        <IconArrowDown size={14} stroke={1.75} aria-hidden />
      </button>
    </div>
  );
}

/** Group flat messages into turns (user message + following assistant messages) */
function groupMessagesIntoTurns(messages: UIMessage[]) {
  const turns: { userMsg?: UIMessage; assistantMsgs: UIMessage[] }[] = [];
  let current: { userMsg?: UIMessage; assistantMsgs: UIMessage[] } | null =
    null;

  for (const msg of messages) {
    if (msg.role === "user") {
      if (current) turns.push(current);
      current = { userMsg: msg, assistantMsgs: [] };
    } else if (msg.role === "assistant") {
      if (!current) current = { assistantMsgs: [] };
      current.assistantMsgs.push(msg);
    }
  }
  if (current) turns.push(current);
  return turns;
}

export const MessageList = memo(function MessageList({
  messages,
  status,
  className,
  showCopyToolbar = true,
  suppressQuestionTool = false,
  initialScrollBehavior = "bottom",
  enableImagePreview = true,
  enterAnimationBaseline = "capture-initial",
  slots,
  classNames,
  toolRenderers,
}: MessageListProps) {
  const stickBottomRef = useRef<StickToBottomContext | null>(null);
  const pendingPlanningScrollUserIdRef = useRef<string | null>(null);
  const [activeCopyId, setActiveCopyId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const mountMessageIdsRef = useRef<Set<string> | null>(null);
  const receiveSoundPlayedRef = useRef(new Set<string>());

  if (mountMessageIdsRef.current === null) {
    mountMessageIdsRef.current =
      enterAnimationBaseline === "none"
        ? new Set<string>()
        : new Set(normalizeMessages(messages).map((message) => message.id));
  }
  const mountBaseline = mountMessageIdsRef.current;

  const CustomUserMessage = slots?.UserMessage || UserMessage;
  const CustomToolRenderer = slots?.ToolRenderer || DefaultToolRenderer;

  const markCopied = useCallback((id: string) => {
    setActiveCopyId(id);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handlePointerDown = () => {
      setActiveCopyId(null);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const isStreaming = status === "streaming" || status === "submitted";

  const normalizedMessages = useMemo(
    () => normalizeMessages(messages),
    [messages],
  );
  const lastUserMessageId = useMemo(
    () => getLastUserMessageId(normalizedMessages),
    [normalizedMessages],
  );
  const lastUserMessageIdRef = useRef(lastUserMessageId);

  useLayoutEffect(() => {
    if (
      lastUserMessageId &&
      lastUserMessageId !== lastUserMessageIdRef.current
    ) {
      lastUserMessageIdRef.current = lastUserMessageId;
      pendingPlanningScrollUserIdRef.current = lastUserMessageId;
      void stickBottomRef.current?.scrollToBottom({ animation: "instant" });
    }
  }, [lastUserMessageId]);

  const lastAssistantMessageId = useMemo(
    () => getLastAssistantMessageId(normalizedMessages),
    [normalizedMessages],
  );
  const assistantHasVisibleContent = useMemo(
    () => getLastAssistantHasVisibleContent(normalizedMessages),
    [normalizedMessages],
  );
  const assistantHasActiveContent = useMemo(
    () => getLastAssistantHasActiveContent(normalizedMessages),
    [normalizedMessages],
  );

  useEffect(() => {
    if (!lastAssistantMessageId || !assistantHasVisibleContent) return;
    if (mountMessageIdsRef.current?.has(lastAssistantMessageId)) return;
    if (receiveSoundPlayedRef.current.has(lastAssistantMessageId)) return;
    receiveSoundPlayedRef.current.add(lastAssistantMessageId);
    playReceiveSound();
  }, [assistantHasVisibleContent, lastAssistantMessageId]);

  const turns = useMemo(
    () => groupMessagesIntoTurns(normalizedMessages),
    [normalizedMessages],
  );
  const initialTurnCount = useRef(turns.length);
  const showPlanning = useMemo(() => {
    const lastMessage = normalizedMessages[normalizedMessages.length - 1];
    if (!lastMessage) return false;
    if (!isStreaming) return false;
    const lastTurn = turns[turns.length - 1];
    const hasAssistant = Boolean(lastTurn && lastTurn.assistantMsgs.length > 0);
    if (lastMessage.role === "user" && !hasAssistant) return true;
    return !assistantHasVisibleContent || !assistantHasActiveContent;
  }, [
    isStreaming,
    normalizedMessages,
    turns,
    assistantHasVisibleContent,
    assistantHasActiveContent,
  ]);

  const toolActivityLabel = useMemo(
    () => getToolActivityLabel(normalizedMessages),
    [normalizedMessages],
  );
  const isToolWorkInProgress = useMemo(
    () => isToolActivityInProgress(normalizedMessages, isStreaming),
    [normalizedMessages, isStreaming],
  );
  const showPlanningIndicator = showPlanning || isToolWorkInProgress;

  const planningLabel = toolActivityLabel
    ? toolActivityLabel
    : assistantHasVisibleContent && !assistantHasActiveContent
      ? "Working..."
      : "Processing...";

  const suppressAssistantForPlanning =
    showPlanning && !assistantHasVisibleContent;

  useLayoutEffect(() => {
    if (!showPlanningIndicator || !lastUserMessageId) return;
    if (pendingPlanningScrollUserIdRef.current !== lastUserMessageId) return;
    void stickBottomRef.current?.scrollToBottom({ animation: "smooth" });
    pendingPlanningScrollUserIdRef.current = null;
  }, [lastUserMessageId, showPlanningIndicator]);

  const stickInitial =
    initialScrollBehavior === "bottom" ? ("instant" as const) : false;
  const stickResize = isStreaming ? ("instant" as const) : ("smooth" as const);

  return (
    <StickToBottom
      contextRef={stickBottomRef}
      className={cn(
        "an-message-list relative flex min-h-0 flex-1 flex-col",
        className,
      )}
      resize={stickResize}
      initial={stickInitial}
    >
      <StickToBottom.Content
        className="mx-auto w-full max-w-an px-4 py-6"
        scrollClassName="min-h-0 min-w-0 flex-1"
      >
        <MessageListScrollHeightVar />
        {initialScrollBehavior === "top" ? <InitialScrollToTop /> : null}
        <div className="space-y-2">
          {turns.map((turn, turnIndex) => {
            const isLastTurn = turnIndex === turns.length - 1;
            const turnKey = turn.userMsg?.id ?? `turn-${turnIndex}`;
            const hasScrollAnchor =
              isLastTurn && turns.length > initialTurnCount.current;

            return (
              <div
                key={turnKey}
                className={cn(hasScrollAnchor && "min-h-scroll-anchor")}
              >
                {turn.userMsg &&
                  (() => {
                    const text = getTextFromParts(
                      turn.userMsg!.parts ?? [],
                      "",
                    );

                    const hasParts = (turn.userMsg!.parts ?? []).length > 0;
                    if (!text && !hasParts) return null;
                    const userCreatedAt = (
                      turn.userMsg as { createdAt?: Date | string }
                    )?.createdAt;
                    const userCopyKey = `user-${turn.userMsg.id}`;
                    const userCopyVisible = activeCopyId === userCopyKey;
                    const userTimestamp =
                      isMounted && userCreatedAt
                        ? formatTimestamp(new Date(userCreatedAt))
                        : undefined;
                    // Only render the toolbar when it has content — copy
                    // button (gated by showCopyToolbar) or a timestamp.
                    // Otherwise a 28px-tall empty row inflates the gap to the
                    // assistant reply.
                    const showUserToolbar =
                      (showCopyToolbar && Boolean(text)) ||
                      Boolean(userTimestamp);
                    return (
                      <div className={cn("group/user-message")}>
                        <UserMessageRow
                          message={turn.userMsg}
                          messageId={turn.userMsg.id}
                          mountBaseline={mountBaseline}
                          disableLayout={isStreaming}
                          className={classNames?.userMessage}
                          enableImagePreview={enableImagePreview}
                          CustomUserMessage={CustomUserMessage}
                          showCopyToolbar={showCopyToolbar}
                          text={text}
                          showUserToolbar={showUserToolbar}
                          userCopyKey={userCopyKey}
                          userCopyVisible={userCopyVisible}
                          userTimestamp={userTimestamp}
                          onCopied={markCopied}
                        />
                      </div>
                    );
                  })()}

                {turn.assistantMsgs.length > 0 &&
                  !(isLastTurn && suppressAssistantForPlanning) &&
                  (() => {
                    const assistantText = getTextFromParts(
                      turn.assistantMsgs.flatMap((msg) => msg.parts ?? []),
                      "\n\n",
                    );
                    const isTurnStreaming = isStreaming && isLastTurn;
                    // Only reserve toolbar height when there's actually
                    // something to show in it. With showCopyToolbar=false the
                    // toolbar would otherwise render as a 48px-tall empty box,
                    // creating large gaps between assistant turns.
                    const showToolbar =
                      showCopyToolbar &&
                      Boolean(assistantText.trim()) &&
                      !isTurnStreaming;
                    const copyKey = `assistant-${turnKey}-all`;
                    const toolbarText = showCopyToolbar ? assistantText : "";

                    return (
                      <div className={cn("group/assistant-turn")}>
                        <div className="flex flex-col gap-3">
                          {turn.assistantMsgs.map((msg, i) => {
                            const isLastMsg =
                              isLastTurn && i === turn.assistantMsgs.length - 1;
                            return (
                              <AssistantMessageRow
                                key={msg.id}
                                msg={msg}
                                isLast={isLastMsg}
                                isStreaming={isStreaming}
                                disableLayout={isStreaming}
                                mountBaseline={mountBaseline}
                                suppressQuestionTool={suppressQuestionTool}
                                ToolRendererComponent={CustomToolRenderer}
                                toolRenderers={toolRenderers}
                              />
                            );
                          })}
                        </div>
                        {showToolbar ? (
                          <MessageToolbar
                            text={toolbarText}
                            heightClass="h-[48px] flex items-start w-full"
                            hoverClass="group-hover/assistant-turn:opacity-100 group-hover/assistant-turn:pointer-events-auto"
                            isVisible={activeCopyId === copyKey}
                            alignClass="justify-start"
                            onCopied={() => markCopied(copyKey)}
                          />
                        ) : activeCopyId === copyKey ? (
                          <MessageToolbar
                            text={toolbarText}
                            heightClass="h-[48px] flex items-start w-full"
                            hoverClass="group-hover/assistant-turn:opacity-100 group-hover/assistant-turn:pointer-events-auto"
                            isVisible={true}
                            alignClass="justify-start"
                            onCopied={() => markCopied(copyKey)}
                          />
                        ) : null}
                      </div>
                    );
                  })()}

                {isLastTurn && showPlanningIndicator && (
                  <div className="pt-2 mt-2">
                    <ToolRowBase
                      icon={<SpiralLoader size={12} />}
                      shimmerLabel={planningLabel}
                      completeLabel="Done"
                      isAnimating={true}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </StickToBottom.Content>
      <JumpToLatestMessages />
    </StickToBottom>
  );
});

type UserMessageRowProps = {
  message: UIMessage;
  messageId: string;
  mountBaseline: ReadonlySet<string>;
  disableLayout: boolean;
  className?: string;
  enableImagePreview: boolean;
  CustomUserMessage: React.ComponentType<{
    message: UIMessage;
    className?: string;
    enableImagePreview?: boolean;
  }>;
  showCopyToolbar: boolean;
  text: string;
  showUserToolbar: boolean;
  userCopyKey: string;
  userCopyVisible: boolean;
  userTimestamp?: string;
  onCopied: (id: string) => void;
};

const UserMessageRow = memo(
  function UserMessageRow({
    message,
    messageId,
    mountBaseline,
    disableLayout,
    className,
    enableImagePreview,
    CustomUserMessage,
    showCopyToolbar,
    text,
    showUserToolbar,
    userCopyKey,
    userCopyVisible,
    userTimestamp,
    onCopied,
  }: UserMessageRowProps) {
    return (
      <>
        <AnimatedMessageEnter
          messageId={messageId}
          variant="user"
          mountBaseline={mountBaseline}
          disableLayout={disableLayout}
        >
          <CustomUserMessage
            message={message}
            className={className}
            enableImagePreview={enableImagePreview}
          />
        </AnimatedMessageEnter>
        {showUserToolbar ? (
          <MessageToolbar
            text={showCopyToolbar ? text : ""}
            timestamp={userTimestamp}
            heightClass="h-[28px]"
            hoverClass="group-hover/user-message:opacity-100 group-hover/user-message:pointer-events-auto"
            isVisible={userCopyVisible}
            alignClass="justify-end"
            onCopied={() => onCopied(userCopyKey)}
          />
        ) : null}
      </>
    );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.disableLayout === next.disableLayout &&
    prev.showUserToolbar === next.showUserToolbar &&
    prev.userCopyVisible === next.userCopyVisible &&
    prev.userTimestamp === next.userTimestamp &&
    prev.text === next.text &&
    prev.showCopyToolbar === next.showCopyToolbar &&
    prev.className === next.className &&
    prev.enableImagePreview === next.enableImagePreview &&
    prev.CustomUserMessage === next.CustomUserMessage,
);

type AssistantMessageRowProps = {
  msg: UIMessage;
  isLast: boolean;
  isStreaming: boolean;
  disableLayout: boolean;
  mountBaseline: ReadonlySet<string>;
  suppressQuestionTool: boolean;
  ToolRendererComponent: React.ComponentType<ToolRendererProps>;
  toolRenderers?: Record<string, React.ComponentType<CustomToolRendererProps>>;
};

const AssistantMessageRow = memo(
  function AssistantMessageRow({
    msg,
    isLast,
    isStreaming,
    disableLayout,
    mountBaseline,
    suppressQuestionTool,
    ToolRendererComponent,
    toolRenderers,
  }: AssistantMessageRowProps) {
    return (
      <AnimatedMessageEnter
        messageId={msg.id}
        variant="assistant"
        mountBaseline={mountBaseline}
        disableLayout={disableLayout}
      >
        <AssistantParts
          msg={msg}
          isLast={isLast}
          isStreaming={isStreaming}
          suppressQuestionTool={suppressQuestionTool}
          ToolRendererComponent={ToolRendererComponent}
          toolRenderers={toolRenderers}
        />
      </AnimatedMessageEnter>
    );
  },
  (prev, next) => {
    if (prev.msg.id !== next.msg.id) return false;
    if (prev.isLast !== next.isLast) return false;
    if (prev.isStreaming !== next.isStreaming) return false;
    if (prev.disableLayout !== next.disableLayout) return false;
    if (prev.suppressQuestionTool !== next.suppressQuestionTool) return false;
    if (prev.ToolRendererComponent !== next.ToolRendererComponent) return false;
    if (prev.toolRenderers !== next.toolRenderers) return false;
    if (prev.msg.parts === next.msg.parts) return true;
    if (next.isLast && next.isStreaming) return false;
    return (
      partsFingerprint(prev.msg.parts as unknown[]) ===
      partsFingerprint(next.msg.parts as unknown[])
    );
  },
);

const AssistantParts = memo(function AssistantParts({
  msg,
  isLast,
  isStreaming,
  suppressQuestionTool,
  ToolRendererComponent,
  toolRenderers,
}: {
  msg: UIMessage;
  isLast: boolean;
  isStreaming: boolean;
  suppressQuestionTool: boolean;
  ToolRendererComponent: React.ComponentType<ToolRendererProps>;
  toolRenderers?: Record<string, React.ComponentType<CustomToolRendererProps>>;
}) {
  const parts = useMemo(
    () => normalizeAssistantToolParts(msg.parts ?? []) as unknown[],
    [msg.parts],
  );

  const { elements } = useMemo(() => {
    const elems: React.ReactNode[] = [];
    const taskPartIds = new Set(
      parts
        .filter(
          (p): p is ToolPartBase =>
            isV5ToolPart(p) &&
            (p.type === "tool-Task" || p.type === "tool-Agent") &&
            typeof p.toolCallId === "string",
        )
        .map((p) => p.toolCallId!),
    );
    const nestedToolsMap = new Map<string, ToolPartBase[]>();
    const nestedToolIds = new Set<string>();

    for (const part of parts) {
      if (!isV5ToolPart(part)) continue;
      if (part.type === "tool-TaskOutput") continue;
      if (!part.toolCallId || !part.toolCallId.includes(":")) continue;
      const parentId = part.toolCallId.split(":")[0]!;
      if (!taskPartIds.has(parentId)) continue;
      if (!nestedToolsMap.has(parentId)) {
        nestedToolsMap.set(parentId, []);
      }
      nestedToolsMap.get(parentId)!.push(part);
      nestedToolIds.add(part.toolCallId);
    }

    let i = 0;
    while (i < parts.length) {
      const part = parts[i]!;

      if (isV5ToolPart(part) && part.type === "tool-TaskOutput") {
        i++;
        continue;
      }

      if (isTextPart(part)) {
        const text = part.text;
        if (text) {
          elems.push(
            <div
              key={`${msg.id}-text-${i}`}
              className="group/assistant-text text-[14px]"
            >
              <Markdown
                content={text}
                className="leading-relaxed [&_p]:leading-relaxed"
              />
            </div>,
          );
        }
        i++;
        continue;
      }

      if (isReasoningPart(part)) {
        if (part.text && !isToolActivityReasoningText(part.text)) {
          elems.push(
            <ThinkingTool
              key={`${msg.id}-reasoning-${i}`}
              part={{
                type: "tool-Thinking",
                toolCallId: `${msg.id}-reasoning-${i}`,
                state:
                  part.state === "streaming"
                    ? "input-streaming"
                    : "output-available",
                input: { thought: part.text },
                output: part.text,
              }}
            />,
          );
        }
        i++;
        continue;
      }

      if (isErrorPart(part)) {
        elems.push(
          <ErrorMessage
            key={`${msg.id}-error-${i}`}
            title={part.title}
            message={part.message}
          />,
        );
        i++;
        continue;
      }

      if (isV5ToolPart(part)) {
        if (suppressQuestionTool && isQuestionsV2ToolPart(part)) {
          i++;
          continue;
        }
        if (part.toolCallId && nestedToolIds.has(part.toolCallId)) {
          i++;
          continue;
        }

        const chatStreamingStatus =
          isLast && isStreaming ? "streaming" : undefined;
        const toolCallId = part.toolCallId;
        const nestedTools =
          (part.type === "tool-Task" || part.type === "tool-Agent") &&
          toolCallId
            ? nestedToolsMap.get(toolCallId) || []
            : undefined;
        elems.push(
          <ToolRendererComponent
            key={part.toolCallId ?? `${msg.id}-tool-${i}`}
            part={part}
            nestedTools={nestedTools}
            chatStatus={chatStreamingStatus}
            toolRenderers={toolRenderers}
          />,
        );
        i++;
        continue;
      }

      i++;
    }

    return { elements: elems };
  }, [
    parts,
    msg.id,
    isLast,
    isStreaming,
    suppressQuestionTool,
    ToolRendererComponent,
    toolRenderers,
  ]);

  if (elements.length > 1) {
    return (
      <div className="group/assistant-turn flex flex-col gap-3">{elements}</div>
    );
  }

  return <div className="group/assistant-turn">{elements}</div>;
});

"use client";

import {
  memo,
  useState,
  useCallback,
  useRef,
  useEffect,
  useId,
  type ReactNode,
} from "react";
import type { ChatStatus } from "ai";
import { cn } from "./utils/cn";

type InputConfig = {
  inputBarPlaceholder: string;
  attachmentButtonPosition: "left" | "right";
  attachmentPreviewStyle: "thumbnail" | "chip" | "hidden";
};

const DEFAULT_INPUT_CONFIG: InputConfig = {
  inputBarPlaceholder: "Send a message...",
  attachmentButtonPosition: "right",
  attachmentPreviewStyle: "thumbnail",
};

import {
  IconChevronDown,
  IconChevronUp,
  IconMessageCircleQuestion,
  IconX,
} from "@tabler/icons-react";
import { SendButton } from "./input/send-button";
import { AttachmentButton } from "./input/attachment-button";
import { FileAttachment } from "./input/file-attachment";
import { ContextAttachment } from "./input/context-attachment";
import { useInputTyping } from "./input/input-typing";
import { QuestionPrompt } from "./question/question-prompt";
import { Suggestions, type SuggestionItem } from "./input/suggestions";
import {
  LexicalInput,
  type LexicalInputHandle,
  type MentionItem,
  type MentionTriggerConfig,
} from "./input/lexical-input";
import type { MentionClickHandler } from "./input/mention-node";
import type {
  ContextKind,
  PromptContextPart,
} from "@/lib/context";

export type { MentionItem, MentionTriggerConfig, MentionClickHandler };
export type AttachedCustomContext = PromptContextPart;
export type { ContextKind };
import type {
  QuestionAnswer,
  QuestionConfig,
} from "./question/question-prompt";

export type AttachedImage = {
  id: string;
  filename: string;
  url: string;
  size?: number;
};

export type AttachedFile = {
  id: string;
  filename: string;
  size?: number;
  url?: string;
};

export type InputBarInfoBarBase = {
  position?: "top" | "bottom";
};

/** Legacy text banner — title, description, optional close/action. */
export type InputBarInfoBarText = InputBarInfoBarBase & {
  title?: string;
  description?: string;
  onClose?: () => void;
  /** Optional primary action rendered on the right (e.g. "Upgrade"). */
  action?: {
    label: string;
    onClick: () => void;
  };
};

/** Custom React node rendered inside the info bar chrome. */
export type InputBarInfoBarCustom = InputBarInfoBarBase & {
  content: ReactNode;
};

export type InputBarInfoBar = InputBarInfoBarText | InputBarInfoBarCustom;

function isCustomInfoBar(bar: InputBarInfoBar): bar is InputBarInfoBarCustom {
  return "content" in bar;
}

export type InputBarProps = {
  onSend: (message: { role: "user"; content: string }) => void;
  status: ChatStatus;
  onStop: () => void;
  placeholder?: string;
  className?: string;

  // Attachment support
  onAttach?: () => void;
  attachedImages?: AttachedImage[];
  attachedFiles?: AttachedFile[];
  attachedCustomContexts?: AttachedCustomContext[];
  onRemoveImage?: (id: string) => void;
  onRemoveFile?: (id: string) => void;
  onRemoveCustomContext?: (id: string) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  isDragOver?: boolean;
  /**
   * When true (default) clicking a staged image attachment opens a
   * fullscreen lightbox preview. Set to false to render thumbnails as
   * plain non-interactive previews.
   */
  enableImagePreview?: boolean;

  // Controlled mode
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  suggestions?:
    | SuggestionItem[]
    | {
        items: SuggestionItem[];
        className?: string;
        itemClassName?: string;
      };

  // Typing animation
  typingAnimation?: {
    text: string;
    duration: number;
    image?: string;
    isActive: boolean;
    onComplete: () => void;
  };

  /**
   * Banner above or below the composer. Pass `content` for a fully custom
   * slot (e.g. workspace picker); otherwise use `title` / `description`.
   */
  infoBar?: InputBarInfoBar;

  questionBar?: {
    id: string;
    questions: QuestionConfig[];
    questionIndex?: number;
    totalQuestions?: number;
    onPreviousQuestion?: () => void;
    onNextQuestion?: () => void;
    submitLabel?: string;
    skipLabel?: string;
    allowSkip?: boolean;
    /** When true, Continue/Skip stay visible but cannot fire until input is ready and the agent is idle. */
    submitDisabled?: boolean;
    onSubmit: (
      answer: QuestionAnswer,
      ctx: { questionIndex: number; totalQuestions: number },
    ) => void;
    onSkip?: () => void;
  };

  /** Content rendered on the left of the toolbar, next to the attachment button. */
  leftActions?: React.ReactNode;
  /** Content rendered on the right of the toolbar, before the send button. */
  rightActions?: React.ReactNode;

  /**
   * Enable rich-text input with `@mentions` and `/slash commands` (Lexical-based).
   * When provided (even as an empty array), the input becomes a Lexical editor
   * that renders mentions as clickable chips. When omitted, the classic
   * `<textarea>` is used (zero behavior change).
   */
  mentionTriggers?: MentionTriggerConfig[];
  /** Called when an inserted mention chip is clicked (rich input only). */
  onMentionClick?: MentionClickHandler;
  /** Extra keyboard handling; call `preventDefault()` to skip built-in Enter-to-send. */
  onKeyDown?: (e: React.KeyboardEvent) => void;
};

export const InputBar = memo(function InputBar({
  onSend,
  status,
  onStop,
  placeholder,
  className,
  onAttach,
  attachedImages = [],
  attachedFiles = [],
  attachedCustomContexts = [],
  onRemoveImage,
  onRemoveFile,
  onRemoveCustomContext,
  onPaste,
  isDragOver,
  enableImagePreview = true,
  value: controlledValue,
  onChange: controlledOnChange,
  disabled,
  autoFocus,
  suggestions = [],
  typingAnimation,
  infoBar,
  questionBar,
  leftActions,
  rightActions,
  mentionTriggers,
  onMentionClick,
  onKeyDown,
}: InputBarProps) {
  const [internalInput, setInternalInput] = useState("");
  const [richHasInput, setRichHasInput] = useState(false);
  const richInputTextRef = useRef("");
  const [isInfoBarOpen, setIsInfoBarOpen] = useState(true);
  const [dismissedQuestionId, setDismissedQuestionId] = useState<string | null>(
    null,
  );
  const [questionBarIndex, setQuestionBarIndex] = useState(1);
  const isControlled = controlledValue !== undefined;
  const useRichInput = mentionTriggers !== undefined;
  const input = isControlled
    ? controlledValue
    : useRichInput
      ? richInputTextRef.current
      : internalInput;
  const setInput = useCallback(
    (v: string) => {
      if (isControlled) {
        controlledOnChange?.(v);
        return;
      }
      if (useRichInput) {
        richInputTextRef.current = v;
        const nextHasInput = v.trim().length > 0;
        setRichHasInput((prev) => (prev === nextHasInput ? prev : nextHasInput));
        lexicalRef.current?.setText(v);
        return;
      }
      setInternalInput(v);
    },
    [isControlled, controlledOnChange, useRichInput],
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lexicalRef = useRef<LexicalInputHandle>(null);
  const config = DEFAULT_INPUT_CONFIG;

  const isStreaming = status === "streaming" || status === "submitted";
  const isTyping = typingAnimation?.isActive ?? false;

  // Reset the locally-tracked question index whenever a different question
  // (tool call) becomes active, so a fresh multi-question set always starts
  // at the first question instead of carrying over a stale index.
  useEffect(() => {
    setQuestionBarIndex(1);
  }, [questionBar?.id]);

  const { displayedText, showImage } = useInputTyping(
    typingAnimation?.text ?? "",
    typingAnimation?.duration ?? 2000,
    isTyping,
    typingAnimation?.onComplete ?? (() => {}),
  );

  const effectivePlaceholder = placeholder ?? config.inputBarPlaceholder;

  const showAttach = Boolean(onAttach);
  const attachRight = config.attachmentButtonPosition === "right";

  // Auto-resize textarea (textarea mode only)
  useEffect(() => {
    if (useRichInput) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    const nextHeight = Math.min(el.scrollHeight, 120);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
    el.style.overflowX = "hidden";
  }, [input, useRichInput]);

  useEffect(() => {
    if (!autoFocus) return;
    if (useRichInput) {
      lexicalRef.current?.focus();
    } else {
      textareaRef.current?.focus();
    }
  }, [autoFocus, useRichInput]);

  const handleLexicalChange = useCallback(
    (text: string) => {
      if (isControlled) {
        controlledOnChange?.(text);
        return;
      }
      richInputTextRef.current = text;
      const nextHasInput = text.trim().length > 0;
      setRichHasInput((prev) => (prev === nextHasInput ? prev : nextHasInput));
    },
    [isControlled, controlledOnChange],
  );

  const handleSubmit = useCallback(() => {
    const raw = useRichInput
      ? lexicalRef.current?.getText() ?? richInputTextRef.current
      : input;
    const trimmed = raw.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend({ role: "user", content: trimmed });
    if (useRichInput) {
      richInputTextRef.current = "";
      setRichHasInput(false);
      lexicalRef.current?.clear();
    } else {
      setInput("");
    }
  }, [input, isStreaming, disabled, onSend, setInput, useRichInput]);

  const handleInfoBarClose = useCallback(() => {
    setIsInfoBarOpen(false);
    if (infoBar && !isCustomInfoBar(infoBar)) {
      infoBar.onClose?.();
    }
  }, [infoBar]);

  const infoBarPosition = infoBar?.position ?? "top";
  const shouldShowInfoBar = Boolean(
    infoBar &&
    (isCustomInfoBar(infoBar) ||
      (!isCustomInfoBar(infoBar) && (infoBar.title || infoBar.description))),
  );
  const infoBarData =
    infoBar && !isCustomInfoBar(infoBar) ? infoBar : undefined;

  const infoBarNode =
    shouldShowInfoBar && infoBar ? (
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          isCustomInfoBar(infoBar) ? "min-h-[34px] py-1 px-1" : "h-[34px] px-3",
          "transition-all duration-150 ease-out overflow-hidden",
          isInfoBarOpen ? "opacity-100 max-h-24" : "opacity-0 max-h-0",
          infoBarPosition === "top"
            ? "rounded-t-an-input-border-radius"
            : "rounded-b-an-input-border-radius",
        )}
      >
        {isCustomInfoBar(infoBar) ? (
          <div className="min-w-0 flex-1">{infoBar.content}</div>
        ) : (
          <>
            <div className="min-w-0 truncate text-xs text-an-foreground">
              {infoBarData?.title && (
                <span className="font-medium">{infoBarData.title}</span>
              )}
              {infoBarData?.description && (
                <span className="text-an-foreground-muted/80">
                  {infoBarData.title
                    ? ` ${infoBarData.description}`
                    : infoBarData.description}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {infoBarData?.action && (
                <button
                  type="button"
                  onClick={infoBarData.action.onClick}
                  className="h-6 px-2 rounded-[4px] text-xs font-medium bg-an-primary-color text-an-send-button-color hover:bg-an-primary-color/90 active:scale-[0.98] transition-[background-color,transform] duration-150"
                >
                  {infoBarData.action.label}
                </button>
              )}
              {infoBarData?.onClose && (
                <button
                  type="button"
                  onClick={handleInfoBarClose}
                  className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-an-foreground-muted/70 hover:text-an-foreground hover:bg-an-background-secondary"
                  aria-label="Close"
                >
                  <IconX className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    ) : null;

  const shouldShowQuestionBar = Boolean(
    questionBar && questionBar.id !== dismissedQuestionId,
  );
  const questionBarData = questionBar;
  const questionSet = questionBarData?.questions ?? [];
  const hasQuestions = questionSet.length > 0;
  const derivedTotal = hasQuestions ? questionSet.length : 1;
  const totalQuestions = questionBarData?.totalQuestions ?? derivedTotal;
  const hasExternalQuestionNavigation = Boolean(
    questionBarData?.onPreviousQuestion || questionBarData?.onNextQuestion,
  );
  const questionIndex = hasExternalQuestionNavigation
    ? (questionBarData?.questionIndex ?? 1)
    : questionBarIndex;
  const clampedQuestionIndex = Math.max(
    1,
    Math.min(questionIndex, totalQuestions),
  );
  const activeQuestion = hasQuestions
    ? questionSet[clampedQuestionIndex - 1]
    : undefined;
  const showQuestionNavigation = totalQuestions > 1;
  const canGoPrev = clampedQuestionIndex > 1;
  const canGoNext = clampedQuestionIndex < totalQuestions;

  const handleQuestionPrevious = useCallback(() => {
    if (!canGoPrev) return;
    if (questionBarData?.onPreviousQuestion) {
      questionBarData.onPreviousQuestion();
      return;
    }
    setQuestionBarIndex((prev) => Math.max(1, prev - 1));
  }, [canGoPrev, questionBarData]);

  const handleQuestionNext = useCallback(() => {
    if (!canGoNext) return;
    if (questionBarData?.onNextQuestion) {
      questionBarData.onNextQuestion();
      return;
    }
    setQuestionBarIndex((prev) => Math.min(totalQuestions, prev + 1));
  }, [canGoNext, questionBarData, totalQuestions]);

  const questionBarNode =
    shouldShowQuestionBar && activeQuestion ? (
      <div
        className={cn(
          "border-t border-x border-border max-w-[calc(100%-24px)] w-full mx-auto",
          !shouldShowInfoBar || infoBarPosition === "bottom"
            ? "rounded-t-an-input-border-radius"
            : null,
        )}
      >
        <div className="h-7 border-b border-border px-3 flex items-center justify-between text-xs text-an-tool-color-muted">
          <div className="inline-flex items-center gap-1.5">
            <IconMessageCircleQuestion className="w-3.5 h-3.5" />
            Question
          </div>
          {showQuestionNavigation && (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={handleQuestionPrevious}
                disabled={!canGoPrev}
                className="size-5 inline-flex items-center justify-center rounded-[4px] hover:bg-an-background-secondary disabled:opacity-40"
                aria-label="Previous question"
              >
                <IconChevronUp className="w-3.5 h-3.5" />
              </button>
              <span>
                {clampedQuestionIndex} of {totalQuestions}
              </span>
              <button
                type="button"
                onClick={handleQuestionNext}
                disabled={!canGoNext}
                className="size-5 inline-flex items-center justify-center rounded-[4px] hover:bg-an-background-secondary disabled:opacity-40"
                aria-label="Next question"
              >
                <IconChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <QuestionPrompt
          key={`${clampedQuestionIndex}-${activeQuestion?.title ?? "question"}`}
          questions={questionSet}
          questionIndex={clampedQuestionIndex}
          totalQuestions={totalQuestions}
          submitLabel={questionBarData!.submitLabel}
          skipLabel={questionBarData!.skipLabel}
          allowSkip={questionBarData!.allowSkip}
          submitDisabled={questionBarData!.submitDisabled}
          onSubmit={(answer) => {
            if (questionBarData!.submitDisabled) return;
            questionBarData!.onSubmit(answer, {
              questionIndex: clampedQuestionIndex,
              totalQuestions,
            });
            if (clampedQuestionIndex >= totalQuestions) {
              setDismissedQuestionId(questionBarData!.id);
            } else if (!hasExternalQuestionNavigation) {
              setQuestionBarIndex((prev) =>
                Math.min(totalQuestions, prev + 1),
              );
            }
          }}
          onSkip={() => {
            questionBarData!.onSkip?.();
          }}
        />
      </div>
    ) : null;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, onKeyDown],
  );

  const hasInput = useRichInput
    ? isControlled
      ? (controlledValue?.trim().length ?? 0) > 0
      : richHasInput
    : input.trim().length > 0;
  const hasContextItems =
    attachedImages.length > 0 ||
    attachedFiles.length > 0 ||
    attachedCustomContexts.length > 0;
  const showContextItems =
    hasContextItems && config.attachmentPreviewStyle !== "hidden";
  const imageDisplayMode =
    config.attachmentPreviewStyle === "thumbnail" ? "image-only" : "chip";

  const composerFieldId = useId();

  const handleSuggestionSelect = useCallback(
    (item: SuggestionItem) => {
      if (disabled || isStreaming) return;
      setInput(item.value ?? item.label);
      requestAnimationFrame(() => {
        if (useRichInput) {
          lexicalRef.current?.focus();
          return;
        }
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
      });
    },
    [disabled, isStreaming, setInput, useRichInput],
  );

  const suggestionItems = Array.isArray(suggestions)
    ? suggestions
    : (suggestions?.items ?? []);
  const suggestionsClassName = Array.isArray(suggestions)
    ? undefined
    : suggestions?.className;
  const suggestionItemClassName = Array.isArray(suggestions)
    ? undefined
    : suggestions?.itemClassName;

  return (
    <div className={cn("shrink-0 px-2 pb-2", className)}>
      <div className="mx-auto max-w-an">
        <div
          className={cn(
            "flex flex-col gap-0",
            shouldShowInfoBar
              ? "bg-an-background-tertiary rounded-an-input-border-radius"
              : null,
          )}
        >
          {infoBarPosition === "top" && infoBarNode}
          {questionBarNode}
          <div
            className={cn(
              "relative rounded-an-input-border-radius bg-an-input-background shadow-2xs ring-1 ring-foreground/10",
              isDragOver && "ring-2 ring-an-primary-color",
            )}
          >
            {/* Context items (attached images/files) */}
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out grid-rows-[0fr]",
                showContextItems && "grid-rows-[1fr]",
              )}
            >
              <div className="overflow-hidden">
                {showContextItems && (
                  <div className="flex flex-wrap items-center gap-[6px] px-an-context-padding pt-an-context-padding pb-0.5">
                    {attachedImages.map((img) => (
                      <FileAttachment
                        key={img.id}
                        id={img.id}
                        filename={img.filename}
                        size={img.size}
                        isImage
                        url={img.url}
                        display={imageDisplayMode}
                        enableImagePreview={enableImagePreview}
                        onRemove={
                          onRemoveImage
                            ? () => onRemoveImage(img.id)
                            : undefined
                        }
                      />
                    ))}
                    {attachedFiles.map((file) => (
                      <FileAttachment
                        key={file.id}
                        id={file.id}
                        filename={file.filename}
                        size={file.size}
                        onRemove={
                          onRemoveFile ? () => onRemoveFile(file.id) : undefined
                        }
                      />
                    ))}
                    {attachedCustomContexts.map((context) => (
                      <ContextAttachment
                        key={context.id}
                        context={context}
                        onRemove={
                          onRemoveCustomContext
                            ? () => onRemoveCustomContext(context.id)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Typing animation image */}
            {isTyping && typingAnimation?.image && showImage && (
              <div className="flex gap-2 flex-wrap px-3 pt-3">
                <div className="relative overflow-hidden shrink-0 w-16 h-16 rounded-md">
                  <img
                    src={typingAnimation.image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Text input or typing animation text — `relative` contains the
                focus ring so it does not stack over the toolbar below. */}
            <label
              htmlFor={composerFieldId}
              className="block cursor-text pt-3 pb-0 pr-3 pl-3.5 min-h-[44px]"
            >
              {isTyping ? (
                <div className="w-full text-[14px] leading-[1.6] text-an-foreground-muted">
                  <span>{displayedText}</span>
                  <span className="inline-block w-[2px] h-[1em] ml-px align-text-bottom bg-an-foreground animate-an-blink" />
                </div>
              ) : useRichInput ? (
                <>
                  <div className="peer">
                    <LexicalInput
                      ref={lexicalRef}
                      inputId={composerFieldId}
                      placeholder={effectivePlaceholder}
                      disabled={disabled}
                      autoFocus={autoFocus}
                      onChange={
                        isControlled ? controlledOnChange : handleLexicalChange
                      }
                      onSubmit={handleSubmit}
                      onPaste={onPaste}
                      onKeyDown={onKeyDown}
                      triggers={mentionTriggers}
                      onMentionClick={onMentionClick}
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-an-input-border-radius outline-2 outline-an-input-focus-outline opacity-0 transition-opacity duration-75 peer-focus-within:opacity-100 z-20 ease-in-out" />
                </>
              ) : (
                <>
                  <textarea
                    id={composerFieldId}
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={onPaste}
                    placeholder={effectivePlaceholder}
                    disabled={disabled}
                    rows={1}
                    className={cn(
                      "peer w-full resize-none bg-transparent border-0 outline-none text-[14px] leading-[1.6] text-an-foreground placeholder:text-an-input-placeholder-color",
                      "overflow-hidden",
                      disabled && "opacity-50 cursor-not-allowed",
                    )}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-an-input-border-radius outline-2 outline-an-input-focus-outline opacity-0 transition-opacity duration-75 peer-focus-visible:opacity-100 peer-focus:opacity-100 z-20 ease-in-out" />
                </>
              )}
            </label>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-2">
              <div className="flex items-center gap-1 min-w-0">
                {!attachRight && showAttach && onAttach && (
                  <AttachmentButton onClick={onAttach} />
                )}
                {leftActions}
              </div>
              <div className="flex items-center gap-1">
                {rightActions}
                {attachRight && showAttach && onAttach && (
                  <AttachmentButton onClick={onAttach} />
                )}
                {/* Send / Stop button */}
                <button
                  type="button"
                  disabled={!isStreaming && (!hasInput || disabled)}
                  aria-label={isStreaming ? "Stop response" : "Send message"}
                  onClick={() => {
                    if (isStreaming) {
                      onStop();
                    } else if (hasInput) {
                      handleSubmit();
                    }
                  }}
                  className="cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default"
                >
                  <SendButton
                    state={
                      isStreaming
                        ? "streaming"
                        : hasInput && !disabled
                          ? "typing"
                          : "idle"
                    }
                  />
                </button>
              </div>
            </div>
          </div>
          {suggestionItems.length > 0 && (
            <Suggestions
              items={suggestionItems}
              onSelect={handleSuggestionSelect}
              disabled={disabled || isStreaming}
              className={cn("mt-4 px-3", suggestionsClassName)}
              itemClassName={suggestionItemClassName}
            />
          )}
          {infoBarPosition === "bottom" && infoBarNode}
        </div>
      </div>
    </div>
  );
});

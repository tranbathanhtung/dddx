"use client";

import {
  memo,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
  useEffect,
  useMemo,
  type ComponentType,
  type ComponentProps,
} from "react";
import type { UIMessage } from "ai";
import { playSendSound } from "./utils/imessage-sounds";
import { MessageList } from "./message-list";
import { InputBar } from "./input-bar";
import { Suggestions, type SuggestionItem } from "./input/suggestions";
import { cn } from "./utils/cn";
import type { AgentChatProps } from "./types";
import { isQuestionToolPartResolved } from "./question/question-part-status";
import {
  isQuestionsV2ToolPart,
  parseQuestionToolInput,
} from "./question/questions-v2";

type PendingQuestion = NonNullable<ReturnType<typeof findPendingQuestion>>;

type AgentChatInputSectionProps = {
  InputBarComponent: ComponentType<ComponentProps<typeof InputBar>>;
  onSend: AgentChatProps["onSend"];
  status: AgentChatProps["status"];
  onStop: AgentChatProps["onStop"];
  className?: string;
  attachments?: AgentChatProps["attachments"];
  suggestions?: AgentChatProps["suggestions"];
  emptySuggestionsPlacement?: AgentChatProps["emptySuggestionsPlacement"];
  pendingQuestion: PendingQuestion | null;
  questionTool?: AgentChatProps["questionTool"];
};

const EMPTY_SUGGESTIONS: SuggestionItem[] = [];

const AgentChatInputSection = memo(function AgentChatInputSection({
  InputBarComponent,
  onSend,
  status,
  onStop,
  className,
  attachments,
  suggestions,
  emptySuggestionsPlacement = "input",
  pendingQuestion,
  questionTool,
}: AgentChatInputSectionProps) {
  const handleSend = useCallback(
    (message: { role: "user"; content: string }) => {
      playSendSound();
      onSend(message);
    },
    [onSend],
  );

  const isChatBusy = status === "streaming" || status === "submitted";
  const questionSubmitDisabled = Boolean(
    pendingQuestion && (isChatBusy || pendingQuestion.inputNotReady),
  );
  const showInputSuggestions =
    emptySuggestionsPlacement === "input" ||
    emptySuggestionsPlacement === "both";

  const questionBar = useMemo(() => {
    if (!pendingQuestion) return undefined;
    return {
      id: pendingQuestion.id,
      questions: pendingQuestion.questions,
      questionIndex: pendingQuestion.questionIndex,
      totalQuestions: pendingQuestion.totalQuestions,
      onPreviousQuestion: pendingQuestion.onPreviousQuestion,
      onNextQuestion: pendingQuestion.onNextQuestion,
      submitLabel: pendingQuestion.submitLabel,
      skipLabel: pendingQuestion.skipLabel,
      allowSkip: pendingQuestion.allowSkip,
      submitDisabled: questionSubmitDisabled,
      onSubmit: (
        answer: import("./question/question-prompt").QuestionAnswer,
        ctx: { questionIndex: number; totalQuestions: number },
      ) => {
        if (questionSubmitDisabled) return;
        const idx = ctx.questionIndex;
        questionTool?.onAnswer?.({
          toolCallId: pendingQuestion.toolCallId,
          question: pendingQuestion.questions[idx - 1]!,
          answer,
          questionIndex: idx,
          totalQuestions: ctx.totalQuestions,
        });
      },
    };
  }, [pendingQuestion, questionSubmitDisabled, questionTool]);

  const inputSuggestions = showInputSuggestions
    ? (suggestions ?? EMPTY_SUGGESTIONS)
    : EMPTY_SUGGESTIONS;

  return (
    <InputBarComponent
      onSend={handleSend}
      status={status}
      onStop={onStop}
      placeholder="Send a message..."
      className={cn(className)}
      onAttach={attachments?.onAttach}
      attachedImages={attachments?.images}
      attachedFiles={attachments?.files}
      attachedCustomContexts={attachments?.customContexts}
      onRemoveImage={attachments?.onRemoveImage}
      onRemoveFile={attachments?.onRemoveFile}
      onRemoveCustomContext={attachments?.onRemoveCustomContext}
      onPaste={attachments?.onPaste}
      isDragOver={attachments?.isDragOver}
      suggestions={inputSuggestions}
      questionBar={questionBar}
    />
  );
});

type AgentChatMessagesPanelProps = {
  enterAnimationBaseline: "capture-initial" | "none";
  messages: UIMessage[];
  status: AgentChatProps["status"];
  error?: Error;
  classNames?: AgentChatProps["classNames"];
  slots?: AgentChatProps["slots"];
  toolRenderers?: AgentChatProps["toolRenderers"];
  showCopyToolbar?: boolean;
  initialScrollBehavior?: AgentChatProps["initialScrollBehavior"];
  enableImagePreview?: boolean;
  suppressQuestionTool: boolean;
};

const AgentChatMessagesPanel = memo(function AgentChatMessagesPanel({
  enterAnimationBaseline,
  messages,
  status,
  error,
  classNames,
  slots,
  toolRenderers,
  showCopyToolbar,
  initialScrollBehavior,
  enableImagePreview,
  suppressQuestionTool,
}: AgentChatMessagesPanelProps) {
  const isStreaming = status === "streaming" || status === "submitted";
  const streamMessages = useStreamCoalescedMessages(messages, isStreaming);

  const displayMessages = useMemo(
    () =>
      error
        ? [
            ...streamMessages,
            {
              id: "agent-chat-error",
              role: "assistant",
              parts: [
                {
                  type: "error",
                  title: "Request failed",
                  message: error.message,
                },
              ],
            } as unknown as (typeof messages)[number],
          ]
        : streamMessages,
    [streamMessages, error],
  );

  return (
    <MessageList
      enterAnimationBaseline={enterAnimationBaseline}
      messages={displayMessages}
      status={status}
      classNames={classNames}
      slots={slots}
      toolRenderers={toolRenderers}
      showCopyToolbar={showCopyToolbar}
      initialScrollBehavior={initialScrollBehavior}
      enableImagePreview={enableImagePreview}
      suppressQuestionTool={suppressQuestionTool}
    />
  );
});

/** Coalesce rapid streaming message updates to at most one React commit per frame. */
function useStreamCoalescedMessages(
  messages: UIMessage[],
  isStreaming: boolean,
): UIMessage[] {
  const [coalesced, setCoalesced] = useState(messages);
  const latestRef = useRef(messages);
  latestRef.current = messages;

  useEffect(() => {
    if (!isStreaming) {
      setCoalesced(messages);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setCoalesced(latestRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, isStreaming]);

  return isStreaming ? coalesced : messages;
}

export type AgentChatInputSlotProps = AgentChatInputSectionProps;

/** Stable input slot — does not subscribe to streaming `messages`. */
export const AgentChatInputSlot = memo(
  function AgentChatInputSlot(props: AgentChatInputSlotProps) {
    return <AgentChatInputSection {...props} />;
  },
  (prev, next) =>
    pendingQuestionSignature(prev.pendingQuestion) ===
      pendingQuestionSignature(next.pendingQuestion) &&
    prev.status === next.status &&
    prev.onSend === next.onSend &&
    prev.onStop === next.onStop &&
    prev.InputBarComponent === next.InputBarComponent &&
    prev.className === next.className &&
    prev.attachments === next.attachments &&
    prev.suggestions === next.suggestions &&
    prev.emptySuggestionsPlacement === next.emptySuggestionsPlacement &&
    prev.questionTool === next.questionTool,
);

export function pendingQuestionSignature(
  pendingQuestion: PendingQuestion | null,
): string {
  if (!pendingQuestion) return "";
  return `${pendingQuestion.id}:${pendingQuestion.inputNotReady ? "streaming" : "ready"}:${pendingQuestion.questionIndex ?? 1}`;
}

export type AgentChatConversationProps = Pick<
  AgentChatProps,
  | "messages"
  | "status"
  | "error"
  | "loadingContent"
  | "classNames"
  | "slots"
  | "toolRenderers"
  | "showCopyToolbar"
  | "initialScrollBehavior"
  | "enableImagePreview"
  | "suggestions"
  | "emptyContent"
  | "emptyStatePosition"
  | "emptySuggestionsPlacement"
  | "emptySuggestionsPosition"
  | "questionTool"
  | "className"
  | "style"
> & {
  pendingQuestion: PendingQuestion | null;
};

/** Message list + empty/loading states only (no input bar). */
export const AgentChatConversation = memo(function AgentChatConversation({
  messages,
  status,
  error,
  loadingContent,
  classNames,
  slots,
  toolRenderers,
  showCopyToolbar,
  initialScrollBehavior,
  enableImagePreview,
  suggestions,
  emptyContent,
  emptyStatePosition = "default",
  emptySuggestionsPlacement = "input",
  emptySuggestionsPosition = "top",
  questionTool: _questionTool,
  pendingQuestion,
  className,
  style,
}: AgentChatConversationProps) {
  const [emptyDraft, setEmptyDraft] = useState("");

  const isEmpty = !error && messages.length === 0;
  const isCenteredEmptyState = isEmpty && emptyStatePosition === "center";
  const wasEmptyRef = useRef(isEmpty);
  const wasLoadingRef = useRef(Boolean(loadingContent));
  const openedFromEmptySend =
    wasEmptyRef.current &&
    !isEmpty &&
    !loadingContent &&
    !wasLoadingRef.current;
  const messageEnterBaseline = openedFromEmptySend ? "none" : "capture-initial";

  useLayoutEffect(() => {
    wasEmptyRef.current = isEmpty;
    wasLoadingRef.current = Boolean(loadingContent);
  }, [isEmpty, loadingContent]);

  const suggestionConfig = resolveSuggestions(suggestions);
  const showEmptySuggestions =
    isCenteredEmptyState &&
    (emptySuggestionsPlacement === "empty" ||
      emptySuggestionsPlacement === "both") &&
    suggestionConfig.items.length > 0;

  const handleEmptySuggestionSelect = (item: SuggestionItem) => {
    setEmptyDraft(item.value ?? item.label);
  };

  const emptyBody =
    emptyContent == null
      ? null
      : typeof emptyContent === "function"
        ? emptyContent({ setDraft: setEmptyDraft })
        : emptyContent;
  const hasCustomEmptyLayout = emptyBody != null && emptyBody !== false;

  const emptySuggestionsNode = showEmptySuggestions ? (
    <Suggestions
      items={suggestionConfig.items}
      onSelect={handleEmptySuggestionSelect}
      disabled={status === "streaming" || status === "submitted"}
      className={cn(
        "w-full justify-center",
        emptySuggestionsPosition === "top" ? "mb-3" : "mt-3",
        suggestionConfig.className,
      )}
      itemClassName={cn("h-8 rounded-md px-3", suggestionConfig.itemClassName)}
    />
  ) : null;

  return (
    <div
      className={cn(
        "an-root flex min-h-0 flex-1 flex-col",
        classNames?.root,
        className,
      )}
      style={style}
    >
      {loadingContent ? (
        <div className="flex-1 min-h-0">{loadingContent}</div>
      ) : isCenteredEmptyState ? (
        <div
          className={cn(
            hasCustomEmptyLayout
              ? "flex min-h-0 flex-1 flex-col px-2 py-2"
              : "flex flex-1 min-h-0 items-center justify-center px-2 py-2",
          )}
        >
          {hasCustomEmptyLayout && (
            <div className="min-h-0 flex-1 overflow-hidden">{emptyBody}</div>
          )}
          <div
            className={cn(
              hasCustomEmptyLayout
                ? "w-full max-w-an"
                : "mx-auto w-full max-w-an shrink-0 pt-2",
            )}
          >
            {emptySuggestionsPosition === "top" ? emptySuggestionsNode : null}
            {emptySuggestionsPosition === "bottom"
              ? emptySuggestionsNode
              : null}
          </div>
        </div>
      ) : (
        <AgentChatMessagesPanel
          enterAnimationBaseline={messageEnterBaseline}
          messages={messages}
          status={status}
          error={error}
          classNames={classNames}
          slots={slots}
          toolRenderers={toolRenderers}
          showCopyToolbar={showCopyToolbar}
          initialScrollBehavior={initialScrollBehavior}
          enableImagePreview={enableImagePreview}
          suppressQuestionTool={Boolean(pendingQuestion)}
        />
      )}
    </div>
  );
});

export function AgentChat({
  messages,
  onSend,
  status,
  onStop,
  error,
  loadingContent,
  classNames,
  slots,
  toolRenderers,
  attachments,
  showCopyToolbar,
  initialScrollBehavior,
  enableImagePreview,
  suggestions,
  emptyContent,
  emptyStatePosition = "default",
  emptySuggestionsPlacement = "input",
  emptySuggestionsPosition = "top",
  questionTool,
  className,
  style,
}: AgentChatProps) {
  const ResolvedInputBar = slots?.InputBar ?? InputBar;

  const pendingQuestion = useMemo(
    () => findPendingQuestion(messages, questionTool),
    [messages, questionTool],
  );

  return (
    <div
      className={cn(
        "an-root flex h-full flex-col",
        classNames?.root,
        className,
      )}
      style={style}
    >
      <AgentChatConversation
        messages={messages}
        status={status}
        error={error}
        loadingContent={loadingContent}
        classNames={classNames}
        slots={slots}
        toolRenderers={toolRenderers}
        showCopyToolbar={showCopyToolbar}
        initialScrollBehavior={initialScrollBehavior}
        enableImagePreview={enableImagePreview}
        suggestions={suggestions}
        emptyContent={emptyContent}
        emptyStatePosition={emptyStatePosition}
        emptySuggestionsPlacement={emptySuggestionsPlacement}
        emptySuggestionsPosition={emptySuggestionsPosition}
        questionTool={questionTool}
        pendingQuestion={pendingQuestion}
      />
      <AgentChatInputSlot
        pendingQuestion={pendingQuestion}
        questionTool={questionTool}
        InputBarComponent={ResolvedInputBar}
        onSend={onSend}
        status={status}
        onStop={onStop}
        className={classNames?.inputBar}
        attachments={attachments}
        suggestions={suggestions}
        emptySuggestionsPlacement={emptySuggestionsPlacement}
      />
    </div>
  );
}

function resolveSuggestions(suggestions: AgentChatProps["suggestions"]) {
  if (Array.isArray(suggestions)) {
    return {
      items: suggestions,
      className: undefined,
      itemClassName: undefined,
    };
  }
  return {
    items: suggestions?.items ?? [],
    className: suggestions?.className,
    itemClassName: suggestions?.itemClassName,
  };
}

export function findPendingQuestion(
  messages: AgentChatProps["messages"],
  questionTool: AgentChatProps["questionTool"],
) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;
    const parts = message.parts ?? [];
    for (let p = parts.length - 1; p >= 0; p -= 1) {
      const part = parts[p] as {
        type?: string;
        toolCallId?: string;
        input?: {
          questions?: import("./question/question-prompt").QuestionConfig[];
          question?: import("./question/question-prompt").QuestionConfig;
          questionIndex?: number;
          totalQuestions?: number;
          onPreviousQuestion?: () => void;
          onNextQuestion?: () => void;
          submitLabel?: string;
          skipLabel?: string;
          allowSkip?: boolean;
        };
        output?: unknown;
        state?: string;
      };
      if (!isQuestionsV2ToolPart(part)) continue;
      const questions = parseQuestionToolInput(part.input);
      const firstQuestion = questions[0];
      if (!firstQuestion) continue;
      if (isQuestionToolPartResolved(part)) continue;
      const input =
        part.input && typeof part.input === "object"
          ? (part.input as {
              questionIndex?: number;
              totalQuestions?: number;
              onPreviousQuestion?: () => void;
              onNextQuestion?: () => void;
              submitLabel?: string;
              skipLabel?: string;
              allowSkip?: boolean;
            })
          : undefined;
      return {
        id: part.toolCallId ?? `question-${i}-${p}`,
        toolCallId: part.toolCallId,
        questions,
        question: firstQuestion,
        questionIndex: input?.questionIndex,
        totalQuestions:
          input?.totalQuestions ??
          (questions.length > 0 ? questions.length : undefined),
        onPreviousQuestion: input?.onPreviousQuestion,
        onNextQuestion: input?.onNextQuestion,
        submitLabel: questionTool?.submitLabel ?? input?.submitLabel,
        skipLabel: questionTool?.skipLabel ?? input?.skipLabel,
        allowSkip: questionTool?.allowSkip ?? input?.allowSkip,
        inputNotReady: part.state === "input-streaming",
      };
    }
  }
  return null;
}

// Legacy component alias kept for compatibility.
export const AnAgentChat = AgentChat;

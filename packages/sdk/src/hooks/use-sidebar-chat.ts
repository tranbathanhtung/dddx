import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { skipToken } from "@tanstack/react-query";

import { api } from "@/client";
import type {
  AttachedCustomContext,
  AttachedFile,
  AttachedImage,
} from "@/components/agent-elements/input-bar";
import type { ModelOption } from "@/components/agent-elements/types";
import { formatAttachedLine } from "@/lib/message-context";
import { useLatest } from "@/hooks/use-latest";
import { supportsPersistedSessions } from "@/lib/agent-capabilities";
import { CustomEventEnum, dispatch } from "@/lib/custom-event";
import { studioApiHeaders } from "@/lib/project-path";
import { DEFAULT_CHAT_MODE, type AgentSetting } from "@/store";
import type { UseCurrentAgentResult } from "@/hooks/use-agents";
import type {
  QuestionAnswer,
  QuestionConfig,
} from "@/components/agent-elements/question/question-prompt";
import {
  applyQuestionAnswerToMessages,
  skipUnresolvedQuestionsInMessages,
} from "@/components/agent-elements/question/question-answers";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Blob URLs are browser-local; the API needs a data URL or remote URL. */
async function toSendableFileUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const response = await fetch(url);
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function guessMediaType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "json":
      return "application/json";
    case "md":
      return "text/markdown";
    default:
      return "application/octet-stream";
  }
}

export type SidebarSendAttachments = {
  images?: AttachedImage[];
  files?: AttachedFile[];
  contexts?: AttachedCustomContext[];
};

export interface UseSidebarChatOptions {
  agentId: string;
  caps: UseCurrentAgentResult["caps"];
  setting: AgentSetting;
  setSessionId: UseCurrentAgentResult["setSessionId"];
  resetSession: UseCurrentAgentResult["resetSession"];
  setPrefs: UseCurrentAgentResult["setPrefs"];
  workspaceId: string;
}

export function useSidebarChat({
  agentId,
  caps,
  setting,
  setSessionId,
  resetSession,
  setPrefs,
  workspaceId,
}: UseSidebarChatOptions) {
  const canPersistSession = caps?.agentCapabilities
    ? supportsPersistedSessions(caps.agentCapabilities)
    : true;

  const persistedSessionId = setting.id?.trim() || undefined;
  const [ephemeralSessionId, setEphemeralSessionId] = useState<
    string | undefined
  >();

  const activeSessionId = canPersistSession
    ? persistedSessionId
    : ephemeralSessionId;

  const models = useMemo<ModelOption[]>(() => {
    const availableModels = caps?.models?.availableModels ?? [];
    return availableModels.map((model) => ({
      id: model.modelId,
      name: model.name ?? model.modelId,
    }));
  }, [caps?.models?.availableModels]);

  const utils = api.useUtils();
  const modeValue = setting.mode ?? DEFAULT_CHAT_MODE;
  const isDesignMode = modeValue === "design";
  const modelValue = setting.model ?? caps?.models?.currentModelId;

  useEffect(() => {
    setEphemeralSessionId(undefined);
  }, [agentId]);

  const bodyRef = useLatest({
    agent: agentId,
    id: activeSessionId ?? null,
    model: modelValue ?? null,
    mode: modeValue,
    workspace: workspaceId,
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => studioApiHeaders(),
        prepareSendMessagesRequest: (input) => ({
          body: {
            ...bodyRef.current,
            messages: input.messages,
          },
        }),
      }),
    [],
  );

  const questionAnswersRef = useRef<
    Map<string, Array<{ question: QuestionConfig; answer: QuestionAnswer }>>
  >(new Map());

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    transport,
    onData: (part) => {
      if (part.type === "data-session") {
        const data = part.data as { id?: string | null };
        if (!data.id) return;
        if (canPersistSession) {
          setSessionId(data.id);
        } else {
          setEphemeralSessionId(data.id);
        }
        return;
      }

      if (part.type === "data-design-active") {
        const data = part.data as { workspaceId?: string };
        const workspaceId = data.workspaceId?.trim();
        if (!workspaceId) return;
        void (async () => {
          await utils.project.workspaces.list.invalidate();
          await utils.project.workspaces.list.refetch();
          setPrefs({ workspace: workspaceId });
          dispatch(CustomEventEnum.DesignWorkspaceActive, {
            detail: { id: workspaceId },
          });
        })();
      }
    },
  });

  const isChatBusy = status === "streaming" || status === "submitted";

  useEffect(() => {
    const watching = isDesignMode && isChatBusy;
    dispatch(CustomEventEnum.DesignWatchActive, { detail: watching });
    if (!isDesignMode || !isChatBusy) {
      dispatch(CustomEventEnum.DesignWorkspaceActive, {
        detail: { id: null },
      });
    }
    return () => dispatch(CustomEventEnum.DesignWatchActive, { detail: false });
  }, [isDesignMode, isChatBusy]);

  const historyQuery = api.chat.list.useQuery(
    !isChatBusy && canPersistSession && agentId && activeSessionId
      ? { agent: agentId, id: activeSessionId }
      : skipToken,
    { enabled: false },
  );

  const isLoadingHistory = historyQuery.isLoading || historyQuery.isFetching;
  const historyError = historyQuery.error
    ? new Error(historyQuery.error.message)
    : undefined;

  useEffect(() => {
    if (!agentId || isChatBusy) return;

    if (!canPersistSession) {
      if (!activeSessionId) setMessages([]);
      return;
    }

    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    historyQuery.refetch().then((response) => {
      setMessages((response.data?.messages ?? []) as unknown as UIMessage[]);
    });
  }, [agentId, activeSessionId, canPersistSession]);

  const startNewSession = useCallback(() => {
    if (canPersistSession) {
      setSessionId(null);
    } else {
      setEphemeralSessionId(undefined);
      resetSession();
    }
    setMessages([]);
  }, [canPersistSession, setSessionId, resetSession, setMessages]);

  const sendText = useCallback(
    (text: string, staged?: SidebarSendAttachments) => {
      void (async () => {
        const fileAttachments = [
          ...(staged?.images ?? []).map((image) => ({
            url: image.url,
            name: image.filename,
            contentType: guessMediaType(image.filename),
          })),
          ...(staged?.files ?? [])
            .filter((file): file is AttachedFile & { url: string } =>
              Boolean(file.url),
            )
            .map((file) => ({
              url: file.url,
              name: file.filename,
              contentType: guessMediaType(file.filename),
            })),
        ];

        const fileUIParts: FileUIPart[] = await Promise.all(
          fileAttachments.map(async (attachment) => ({
            type: "file" as const,
            url: await toSendableFileUrl(attachment.url),
            filename: attachment.name,
            mediaType: attachment.contentType,
          })),
        );

        const contextTextParts = (staged?.contexts ?? []).map((context) => ({
          type: "text" as const,
          text: formatAttachedLine(context),
        }));

        const messageParts = [
          { type: "text" as const, text },
          ...fileUIParts,
          ...contextTextParts,
        ];

        // If the user types a free-text reply while a question is still
        // pending, auto-skip it so it resolves cleanly instead of dangling
        // (and so a follow-up question doesn't stack on an open one).
        setMessages((prev) =>
          skipUnresolvedQuestionsInMessages(prev as UIMessage[]),
        );

        await sendMessage({
          role: "user",
          parts: messageParts,
        });
      })();
    },
    [sendMessage, setMessages],
  );

  const handleQuestionAnswer = useCallback(
    (payload: {
      toolCallId?: string;
      question: QuestionConfig;
      answer: QuestionAnswer;
      questionIndex?: number;
      totalQuestions?: number;
    }) => {
      const toolCallId = payload.toolCallId?.trim();
      if (!toolCallId) return;

      const total = payload.totalQuestions ?? 1;
      const index = Math.max(1, Math.min(payload.questionIndex ?? 1, total));
      const bucket = questionAnswersRef.current.get(toolCallId) ?? [];
      bucket[index - 1] = {
        question: payload.question,
        answer: payload.answer,
      };
      questionAnswersRef.current.set(toolCallId, bucket);

      if (index < total) return;

      const answers = bucket.filter(
        (row): row is { question: QuestionConfig; answer: QuestionAnswer } =>
          row !== undefined,
      );
      questionAnswersRef.current.delete(toolCallId);

      setMessages((prev) =>
        applyQuestionAnswerToMessages(prev as UIMessage[], {
          toolCallId,
          answers,
        }),
      );

      const text = answers
        .map(({ question, answer }) => {
          if (answer.kind === "skip") return "";
          if (answer.kind === "text") return answer.text ?? "";
          const selected =
            answer.selectedIds
              ?.map(
                (id) => question.options?.find((o) => o.id === id)?.label ?? id,
              )
              .join(", ") ?? "";
          if (selected && answer.text?.trim()) {
            return `${selected} — ${answer.text.trim()}`;
          }
          return selected || answer.text?.trim() || "";
        })
        .filter((line) => line.length > 0)
        .join("\n");

      if (!text) return;

      void sendMessage({
        role: "user",
        parts: [{ type: "text", text }],
      });
    },
    [sendMessage, setMessages],
  );

  const questionTool = useMemo(
    () => ({
      submitLabel: "Continue",
      onAnswer: handleQuestionAnswer,
    }),
    [handleQuestionAnswer],
  );

  return {
    messages,
    sendText,
    status,
    stop,
    error,
    setMessages,
    activeSessionId,
    canPersistSession,
    isChatBusy,
    isLoadingHistory,
    historyError,
    models,
    modelValue,
    setPrefs,
    startNewSession,
    capabilityNotice: caps?.capabilityNotice,
    questionTool,
  };
}

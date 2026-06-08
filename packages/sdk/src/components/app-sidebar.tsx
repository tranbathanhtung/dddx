import React, { memo, useCallback, useEffect, useMemo, useRef } from "react";
import {
  IconChevronDown,
  IconHistory,
  IconSparkles,
  IconPlus,
  IconPalette,
  IconCode,
} from "@tabler/icons-react";

import { AgentPicker } from "./agent-picker";
import { SessionHistory } from "./sessions";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

import { ProjectRail } from "@/components/project-rail";

import { useAttachments } from "@/hooks/use-attachments";
import {
  useCurrentAgent,
  type UseCurrentAgentResult,
} from "@/hooks/use-agents";
import { useLatest } from "@/hooks/use-latest";
import { useSidebarChat } from "@/hooks/use-sidebar-chat";
import { usePluginMentions } from "@/hooks/use-plugin-mentions";
import { useWorkspaces } from "@/hooks/use-workspaces";
import {
  AgentChatConversation,
  AgentChatInputSlot,
  findPendingQuestion,
  pendingQuestionSignature,
} from "@/components/agent-elements/agent-chat";
import { InputBar } from "@/components/agent-elements/input-bar";
import type { MentionTriggerConfig } from "@/components/agent-elements/input/lexical-input";
import {
  ModeSelector,
  type ModeOption,
} from "@/components/agent-elements/input/mode-selector";
import { ModelPicker } from "./agent-elements/input/model-picker";
import type { ModelOption } from "@/components/agent-elements/types";
import { ChatEmptyState } from "@/components/chat-empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomEventEnum, listen } from "@/lib/custom-event";
import { DEFAULT_CHAT_MODE, useStudioStore } from "@/store";
import type { AttachedCustomContext } from "@/components/agent-elements/input-bar";

type ChatMode = "agent" | "design";

const CHAT_MODES: ModeOption[] = [
  {
    id: "agent",
    label: "Agent",
    icon: IconCode,
    description: "Edit the real codebase.",
  },
  {
    id: "design",
    label: "Design",
    icon: IconPalette,
    description: "Explore in an auto-created design folder.",
  },
];

type SidebarInputChrome = {
  handleInputKeyDown: (e: React.KeyboardEvent) => void;
  modeValue: ChatMode;
  handleModeChange: (next: string) => void;
  handleModelChange: (model: string) => void;
  modeDisabled: boolean;
  models: ModelOption[];
  modelValue?: string;
  pluginMentions: MentionTriggerConfig;
};

/** Module-level so Tab / agent changes do not remount Lexical. */
const SidebarInputBar = memo(function SidebarInputBar({
  chrome,
  ...inputProps
}: React.ComponentProps<typeof InputBar> & { chrome: SidebarInputChrome }) {
  const mentionTriggers = useMemo(
    () => [chrome.pluginMentions],
    [chrome.pluginMentions],
  );

  const leftActions = (
    <>
      <ModeSelector
        modes={CHAT_MODES}
        value={chrome.modeValue}
        onChange={chrome.handleModeChange}
        disabled={chrome.modeDisabled}
        className={
          chrome.modeValue === "design"
            ? "bg-orange-100 text-orange-700 hover:bg-orange-100 hover:text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 dark:hover:bg-orange-950/60 dark:hover:text-orange-300"
            : ""
        }
      />
      {chrome.models.length > 0 ? (
        <ModelPicker
          models={chrome.models}
          value={chrome.modelValue}
          onChange={chrome.handleModelChange}
        />
      ) : null}
    </>
  );

  return (
    <InputBar
      {...inputProps}
      onKeyDown={(e) => {
        chrome.handleInputKeyDown(e);
        if (!e.defaultPrevented) inputProps.onKeyDown?.(e);
      }}
      placeholder="Design, Build, / for skills"
      leftActions={leftActions}
      mentionTriggers={mentionTriggers}
    />
  );
});

type SidebarChatHeaderSlotProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeSessionId?: string;
  canPersistSession: boolean;
  capabilityNotice?: string;
  onNewSession: () => void;
  agentIcon?: string;
  agentName?: string;
};

const SidebarChatHeaderSlot = memo(function SidebarChatHeaderSlot({
  containerRef,
  activeSessionId,
  canPersistSession,
  capabilityNotice,
  onNewSession,
  agentIcon,
  agentName,
}: SidebarChatHeaderSlotProps) {
  const agent =
    agentIcon || agentName ? { icon: agentIcon, name: agentName } : undefined;

  return (
    <AppSidebarHeader
      containerRef={containerRef}
      activeSessionId={activeSessionId}
      canPersistSession={canPersistSession}
      capabilityNotice={capabilityNotice}
      onNewSession={onNewSession}
      agent={agent}
    />
  );
});

type SidebarChatInputSlotWrapperProps = {
  pendingQuestionSig: string;
  pendingQuestion: ReturnType<typeof findPendingQuestion>;
  questionTool: ReturnType<typeof useSidebarChat>["questionTool"];
  onSend: (message: { role: "user"; content: string }) => void;
  status: ReturnType<typeof useSidebarChat>["status"];
  onStop: ReturnType<typeof useSidebarChat>["stop"];
  attachments: React.ComponentProps<typeof AgentChatInputSlot>["attachments"];
  inputChrome: SidebarInputChrome;
};

const SidebarChatInputSlotWrapper = memo(
  function SidebarChatInputSlotWrapper({
    pendingQuestion,
    questionTool,
    onSend,
    status,
    onStop,
    attachments,
    inputChrome,
  }: SidebarChatInputSlotWrapperProps) {
    const InputBarComponent = useMemo(
      () =>
        function SidebarBoundInputBar(
          props: React.ComponentProps<typeof InputBar>,
        ) {
          return <SidebarInputBar chrome={inputChrome} {...props} />;
        },
      [inputChrome],
    );

    return (
      <AgentChatInputSlot
        pendingQuestion={pendingQuestion}
        questionTool={questionTool}
        InputBarComponent={InputBarComponent}
        onSend={onSend}
        status={status}
        onStop={onStop}
        attachments={attachments}
      />
    );
  },
  (prev, next) =>
    prev.pendingQuestionSig === next.pendingQuestionSig &&
    prev.status === next.status &&
    prev.onSend === next.onSend &&
    prev.onStop === next.onStop &&
    prev.attachments === next.attachments &&
    prev.questionTool === next.questionTool &&
    prev.inputChrome === next.inputChrome,
);

type SidebarChatPanelProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  agentId: string;
  agent?: { icon?: string; name?: string };
  caps: UseCurrentAgentResult["caps"];
  setting: UseCurrentAgentResult["setting"];
  setPrefs: UseCurrentAgentResult["setPrefs"];
  setSessionId: UseCurrentAgentResult["setSessionId"];
  resetSession: UseCurrentAgentResult["resetSession"];
  workspaceId: string;
};

/** Owns chat streaming state so the outer sidebar shell does not re-render per token. */
function SidebarChatPanel({
  containerRef,
  agentId,
  agent,
  caps,
  setting,
  setPrefs,
  setSessionId,
  resetSession,
  workspaceId,
}: SidebarChatPanelProps) {
  const attachments = useAttachments();
  const modeValue: ChatMode = setting.mode ?? DEFAULT_CHAT_MODE;
  const pluginMentions = usePluginMentions();

  const {
    messages,
    sendText,
    status,
    stop,
    error,
    activeSessionId,
    canPersistSession,
    isLoadingHistory,
    historyError,
    models,
    modelValue,
    setPrefs: setChatPrefs,
    startNewSession,
    capabilityNotice,
    questionTool,
  } = useSidebarChat({
    agentId,
    caps,
    setting,
    setSessionId,
    resetSession,
    setPrefs,
    workspaceId,
  });

  const modeDisabled = status === "streaming" || status === "submitted";

  const handleModeChange = useMemo(
    () => (next: string) => {
      if (next === "agent" || next === "design") {
        setPrefs({ mode: next });
      }
    },
    [setPrefs],
  );

  useEffect(() => {
    return listen(CustomEventEnum.DesignCanvasAgentSend, (event) => {
      const detail = event.detail as {
        text?: string;
        contexts?: AttachedCustomContext[];
        mode?: ChatMode;
      };
      const text = detail.text?.trim();
      if (!text) return;

      if (detail.mode === "agent" || detail.mode === "design") {
        setPrefs({ mode: detail.mode });
      }

      sendText(text, {
        contexts: detail.contexts ?? [],
      });
    });
  }, []);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Tab" || modeDisabled || CHAT_MODES.length < 2) return;
      e.preventDefault();
      e.stopPropagation();
      const currentIndex = CHAT_MODES.findIndex((m) => m.id === modeValue);
      const offset = e.shiftKey ? -1 : 1;
      const nextIndex =
        (currentIndex + offset + CHAT_MODES.length) % CHAT_MODES.length;
      handleModeChange(CHAT_MODES[nextIndex]!.id);
    },
    [modeValue, handleModeChange, modeDisabled],
  );

  const handleModelChange = useCallback(
    (model: string) => setChatPrefs({ model }),
    [setChatPrefs],
  );

  const attachmentsLatest = useLatest(attachments);

  const handleChatSend = useCallback(
    (message: { role: "user"; content: string }) => {
      const staged = attachmentsLatest.current;
      sendText(message.content, {
        images: staged.images,
        files: staged.files,
        contexts: staged.customContexts,
      });
      staged.clearStaged();
    },
    [sendText, attachmentsLatest],
  );

  const chatAttachments = useMemo(
    () => ({
      onAttach: attachments.onAttach,
      images: attachments.images,
      files: attachments.files,
      customContexts: attachments.customContexts,
      onRemoveFile: attachments.onRemoveFile,
      onRemoveImage: attachments.onRemoveImage,
      onRemoveCustomContext: attachments.onRemoveCustomContext,
      onPaste: attachments.onPaste,
      isDragOver: attachments.isDragOver,
    }),
    [
      attachments.onAttach,
      attachments.images,
      attachments.files,
      attachments.customContexts,
      attachments.onRemoveFile,
      attachments.onRemoveImage,
      attachments.onRemoveCustomContext,
      attachments.onPaste,
      attachments.isDragOver,
    ],
  );

  const renderEmptyContent = useCallback(
    () => <ChatEmptyState mode={modeValue} />,
    [modeValue],
  );

  const pendingQuestion = useMemo(
    () => findPendingQuestion(messages, questionTool),
    [messages, questionTool],
  );
  const pendingQuestionSig = pendingQuestionSignature(pendingQuestion);

  const headerSlotProps = useMemo(
    () => ({
      containerRef,
      activeSessionId,
      canPersistSession,
      capabilityNotice,
      onNewSession: startNewSession,
      agentIcon: agent?.icon,
      agentName: agent?.name,
    }),
    [
      activeSessionId,
      canPersistSession,
      capabilityNotice,
      startNewSession,
      agent?.icon,
      agent?.name,
    ],
  );

  const inputChrome = useMemo<SidebarInputChrome>(
    () => ({
      handleInputKeyDown,
      modeValue,
      handleModeChange,
      handleModelChange,
      modeDisabled,
      models,
      modelValue,
      pluginMentions,
    }),
    [
      handleInputKeyDown,
      modeValue,
      handleModeChange,
      handleModelChange,
      modeDisabled,
      models,
      modelValue,
      pluginMentions,
    ],
  );

  const inputSlotProps = useMemo(
    () => ({
      pendingQuestionSig,
      pendingQuestion,
      questionTool,
      onSend: handleChatSend,
      status,
      onStop: stop,
      attachments: chatAttachments,
      inputChrome,
    }),
    [
      pendingQuestionSig,
      pendingQuestion,
      questionTool,
      handleChatSend,
      status,
      stop,
      chatAttachments,
      inputChrome,
    ],
  );

  return (
    <>
      <SidebarChatHeaderSlot {...headerSlotProps} />
      <SidebarContent
        style={{ "--an-input-focus-outline": "#0ea5e9" } as React.CSSProperties}
        className="p-1"
      >
        <input
          aria-label="Attach files"
          className="hidden"
          multiple
          onChange={attachments.onFileInputChange}
          ref={attachments.inputRef}
          type="file"
        />
        <div className="flex h-full min-h-0 flex-col">
          <AgentChatConversation
            messages={messages}
            status={status}
            error={error ?? historyError}
            emptyStatePosition="center"
            emptyContent={renderEmptyContent}
            loadingContent={isLoadingHistory ? <ChatHistorySkeleton /> : null}
            enableImagePreview
            showCopyToolbar
            initialScrollBehavior="bottom"
            questionTool={questionTool}
            pendingQuestion={pendingQuestion}
          />
          <SidebarChatInputSlotWrapper {...inputSlotProps} />
        </div>
      </SidebarContent>
    </>
  );
}

type AppSidebarHeaderProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeSessionId?: string;
  canPersistSession: boolean;
  capabilityNotice?: string;
  onNewSession: () => void;
  agent?: { icon?: string; name?: string };
};

const AppSidebarHeader = memo(function AppSidebarHeader({
  containerRef,
  activeSessionId,
  canPersistSession,
  capabilityNotice,
  onNewSession,
  agent,
}: AppSidebarHeaderProps) {
  return (
    <SidebarHeader className="px-3 h-11 gap-4 border-b items-center flex justify-between flex-row">
      <div className="flex items-center gap-1 flex-1">
        <div className="text-sm font-medium truncate">
          {activeSessionId
            ? `Session ${activeSessionId.slice(0, 8)}...`
            : "New Session"}
        </div>
        {!canPersistSession && activeSessionId ? (
          <span
            className="text-[10px] text-muted-foreground shrink-0"
            title={capabilityNotice}
          >
            (ephemeral)
          </span>
        ) : null}
        {activeSessionId ? (
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground rounded-sm"
            aria-label="New session"
            onClick={onNewSession}
          >
            <IconPlus className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <SessionHistory container={containerRef}>
          <Button
            size="icon-sm"
            variant="ghost"
            className="rounded-sm text-muted-foreground"
            aria-label="Session history"
          >
            <IconHistory className="size-4" />
          </Button>
        </SessionHistory>
        <AgentPicker container={containerRef}>
          <Button
            size="sm"
            variant="outline"
            className="rounded-sm"
            aria-label="Choose agent"
          >
            {agent?.icon ? (
              <img
                src={agent.icon}
                alt={agent.name}
                className="size-3.5 dark:invert"
              />
            ) : (
              <IconSparkles />
            )}
            {agent?.name}
            <IconChevronDown className="size-3.5" />
          </Button>
        </AgentPicker>
      </div>
    </SidebarHeader>
  );
});

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const maximized = useStudioStore((s) => s.ui.maximized);

  const {
    agent,
    setting,
    caps,
    setPrefs,
    setSessionId,
    resetSession,
    id: agentId,
  } = useCurrentAgent();

  const { workspaceId } = useWorkspaces({
    setting,
    setPrefs,
  });

  if (maximized) {
    return (
      <Sidebar collapsible="icon" className="overflow-hidden">
        <ProjectRail />
      </Sidebar>
    );
  }

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      <ProjectRail />

      <Sidebar collapsible="none" className="flex min-w-0 flex-1">
        <div
          ref={containerRef}
          className="relative flex h-full w-full flex-1 flex-col"
        >
          <SidebarChatPanel
            containerRef={containerRef}
            agentId={agentId}
            agent={agent}
            caps={caps}
            setting={setting}
            setPrefs={setPrefs}
            setSessionId={setSessionId}
            resetSession={resetSession}
            workspaceId={workspaceId}
          />
        </div>
        <SidebarRail />
      </Sidebar>
    </Sidebar>
  );
}

function ChatHistorySkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex flex-col items-end gap-2">
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-12 w-11/12 rounded-xl" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

import { memo, useCallback, useEffect, useRef } from "react";
import {
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from "dockview-react";
import {
  IconFileDescription,
  IconWorld,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CustomEventEnum, listen } from "@/lib/custom-event";
import { useStudioStore } from "@/store";
import { PreviewPanel } from "./panels/preview";
import { useActivePreviewBridge } from "./panels/preview/use-active-preview-bridge";
import { DesignPanel } from "./panels/design";
import { TemplatePreviewPanel } from "./panels/template";
import type { TemplatePreviewParams } from "./panels/template";
import { RightActionsComponent } from "./right-actions-component";
import { PrefixHeaderActionsComponent } from "./prefix-header-actions.component";
import { LeftHeaderActionsComponent } from "./left-header-actions.component";
import { PluginsPanel } from "./panels/plugins";
import {
  DOCK_PANEL_ICONS,
  isPreviewPanelId,
  openDockPanel,
  openNewPreviewPanel,
  openTemplatePreviewPanel,
  type DockPanelId,
  type PreviewPanelParams,
} from "./panel-registry";
import { DockviewWatermark } from "./watermark";

const PreviewPanelView = (
  props: IDockviewPanelProps<PreviewPanelParams>,
) => {
  useActivePreviewBridge(props.api);

  return (
    <div className="w-full h-full">
      <PreviewPanel
        bridgeId={props.api.id}
        currentUrl={props.params?.url}
        targetId={props.params?.targetId}
        pickTarget={props.params?.pickTarget}
        onTargetSelect={(target) => {
          props.api.setTitle(target.label);
        }}
      />
    </div>
  );
};

const TemplatePreviewPanelView = (
  props: IDockviewPanelProps<TemplatePreviewParams>,
) => (
  <div className="w-full h-full">
    <TemplatePreviewPanel
      url={props.params?.url}
      title={props.params?.title}
      previewType={props.params?.previewType}
    />
  </div>
);

const DesignPanelView = (_props: IDockviewPanelProps) => (
  <div className="w-full h-full">
    <DesignPanel />
  </div>
);

const PluginsPanelView = (
  props: IDockviewPanelProps<{
    section?: "templates" | "themes";
    category?: string;
  }>,
) => (
  <div className="w-full h-full">
    <PluginsPanel
      section={props.params?.section}
      category={props.params?.category}
    />
  </div>
);

const components = {
  preview: PreviewPanelView,
  design: DesignPanelView,
  plugins: PluginsPanelView,
  templatePreview: TemplatePreviewPanelView,
};

const TAB_ICONS: Record<string, TablerIcon> = {
  ...DOCK_PANEL_ICONS,
  "template-preview": IconFileDescription,
};

const PanelTab = (props: IDockviewPanelHeaderProps) => {
  const panelId = props.api.id;
  const Icon =
    TAB_ICONS[panelId] ??
    (isPreviewPanelId(panelId) ? IconWorld : undefined);
  const title = props.api.title ?? panelId;

  return (
    <div className="group/tab flex h-full min-w-0 items-center gap-2 px-0.5 text-sm leading-5 select-none">
      <span className="relative flex size-3.5 shrink-0 items-center justify-center">
        {Icon ? (
          <Icon
            size={14}
            className="text-current transition-opacity group-hover/tab:opacity-0"
          />
        ) : null}
        <button
          type="button"
          aria-label={`Close ${title}`}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/30 opacity-0 transition-opacity group-hover/tab:opacity-100 hover:bg-foreground/45"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            props.api.close();
          }}
        >
          <IconX size={10} stroke={2.5} className="text-background" />
        </button>
      </span>
      <span className="truncate">{title}</span>
    </div>
  );
};

const tabComponents = {
  default: PanelTab,
};

function syncPanel(panelId: string | undefined) {
  const { setPanel } = useStudioStore.getState().ui;
  if (panelId && isPreviewPanelId(panelId)) {
    setPanel("preview");
    return;
  }
  if (
    panelId === "design" ||
    panelId === "plugins"
  ) {
    setPanel(panelId);
    return;
  }
  setPanel(null);
}

export const DockviewProvider = memo(() => {
  const apiRef = useRef<DockviewReadyEvent["api"] | null>(null);
  const maximized = useStudioStore((s) => s.ui.maximized);

  const handleReady = useCallback((event: DockviewReadyEvent) => {
    apiRef.current = event.api;
    openNewPreviewPanel(event.api);
    openDockPanel(event.api, "design");
    event.api.panels.find((panel) => isPreviewPanelId(panel.id))?.api.setActive();
    syncPanel(event.api.activePanel?.id);
    event.api.onDidActivePanelChange((active) => {
      syncPanel(active?.id);
    });
  }, []);

  useEffect(() => {
    return listen<{
      panelId: DockPanelId;
      params?: Record<string, unknown>;
      title?: string;
    }>(CustomEventEnum.OpenDockPanel, (event) => {
      const api = apiRef.current;
      if (!api || !event.detail?.panelId) return;

      openDockPanel(api, event.detail.panelId, {
        params: event.detail.params,
        title: event.detail.title,
      });
    });
  }, []);

  useEffect(() => {
    return listen<{
      url: string;
      title?: string;
      previewType?: "html" | "image" | "markdown" | "video";
    }>(CustomEventEnum.OpenTemplatePreview, (event) => {
      const api = apiRef.current;
      if (!api || !event.detail?.url) return;

      openTemplatePreviewPanel(api, event.detail);
    });
  }, []);

  return (
    <div className="h-full min-h-0 flex-1">
      <DockviewReact
        onReady={handleReady}
        components={components}
        tabComponents={tabComponents}
        watermarkComponent={DockviewWatermark}
        leftHeaderActionsComponent={LeftHeaderActionsComponent}
        rightHeaderActionsComponent={RightActionsComponent}
        prefixHeaderActionsComponent={PrefixHeaderActionsComponent}
        disableFloatingGroups={false}
        disableTabsOverflowList={true}
        theme={{
          name: "ui",
          className: cn(
            "dockview-theme-ui",
            maximized && "dockview-maximized",
          ),
        }}
      />
    </div>
  );
});

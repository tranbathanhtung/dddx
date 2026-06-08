import {
  IconLayoutGrid,
  IconPalette,
  IconWorld,
  type TablerIcon,
} from "@tabler/icons-react";
import type { DockviewApi } from "dockview-react";

import type { PreviewMediaType } from "@/components/template-preview";
import { CustomEventEnum, dispatch } from "@/lib/custom-event";

export type DockPanelId = "preview" | "design" | "plugins";

export type PreviewPanelParams = {
  url?: string;
  targetId?: string;
  label?: string;
  pickTarget?: boolean;
};

export type DockPanelDefinition = {
  id: DockPanelId;
  component: string;
  title: string;
  description: string;
  icon: TablerIcon;
};

export const DOCK_PANELS: readonly DockPanelDefinition[] = [
  {
    id: "preview",
    component: "preview",
    title: "Preview",
    description: "Preview your running app",
    icon: IconWorld,
  },
  {
    id: "design",
    component: "design",
    title: "Design",
    description: "Themes, tokens, and canvas",
    icon: IconPalette,
  },
  {
    id: "plugins",
    component: "plugins",
    title: "Plugins",
    description: "Browse themes and templates",
    icon: IconLayoutGrid,
  },
] as const;

export const DOCK_PANEL_ICONS: Record<string, TablerIcon> = Object.fromEntries(
  DOCK_PANELS.map((panel) => [panel.id, panel.icon]),
);

type OpenDockPanelOptions = {
  params?: Record<string, unknown>;
  title?: string;
};

export function isPreviewPanelId(panelId: string): boolean {
  return panelId === "preview" || panelId.startsWith("preview:");
}

function hasPreviewPanel(api: DockviewApi): boolean {
  return api.panels.some((panel) => isPreviewPanelId(panel.id));
}

export function openNewPreviewPanel(api: DockviewApi) {
  const id = `preview:${crypto.randomUUID()}`;
  const params: PreviewPanelParams = {
    pickTarget: hasPreviewPanel(api),
  };

  api.addPanel({
    id,
    component: "preview",
    tabComponent: "default",
    title: "Preview",
    params,
    renderer: "always",
  });

  api.getPanel(id)?.api.setActive();
}

export function openDockPanel(
  api: DockviewApi,
  panelId: DockPanelId,
  options: OpenDockPanelOptions = {},
) {
  const definition = DOCK_PANELS.find((panel) => panel.id === panelId);
  if (!definition) return;

  if (panelId === "preview") {
    openNewPreviewPanel(api);
    return;
  }

  const existing = api.getPanel(panelId);
  if (existing) {
    if (options.params) {
      existing.api.updateParameters(options.params);
    }
    if (options.title) {
      existing.api.setTitle(options.title);
    }
    existing.api.setActive();
    return;
  }

  api.addPanel({
    id: panelId,
    component: definition.component,
    tabComponent: "default",
    title: options.title ?? definition.title,
    params: options.params,
    ...(panelId === "plugins" ? { renderer: "always" as const } : {}),
    ...options,
  });

  api.getPanel(panelId)?.api.setActive();
}

/** Open the template preview dock tab (decoupled from Dockview API via custom event). */
export function openTemplatePreview(
  title: string,
  url: string,
  previewType?: PreviewMediaType,
) {
  dispatch(CustomEventEnum.OpenTemplatePreview, {
    detail: { url, title, previewType },
  });
}

export function openTemplatePreviewPanel(
  api: DockviewApi,
  options: {
    url: string;
    title?: string;
    previewType?: PreviewMediaType;
  },
) {
  const title = options.title ?? "Template";
  const panelId = "template-preview";
  const existing = api.getPanel(panelId);
  const params = {
    url: options.url,
    title,
    previewType: options.previewType,
  };

  if (!existing) {
    api.addPanel({
      id: panelId,
      component: "templatePreview",
      tabComponent: "default",
      title,
      params,
      position: {
        direction: "right",
      },
    });
  } else {
    existing.api.updateParameters(params);
    existing.api.setTitle(title);
  }

  api.getPanel(panelId)?.api.setActive();
}

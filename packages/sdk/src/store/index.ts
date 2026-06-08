/**
 * @file store/index.ts
 * @overview Persisted studio UI state (localStorage). Agent rows are scoped
 * per project slug (`/p/<slug>`). Chat transcript is owned by `useChat` in the
 * sidebar, not this store.
 */

import { useEffect, useState } from "react";
import { create, type UseBoundStore } from "zustand";
import type { StateCreator, StoreApi } from "zustand/vanilla";
import {
  createJSONStorage,
  persist,
  type PersistOptions,
} from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { replay as replayExt, sync } from "@/extensions/sync";
import { merge } from "@/lib/merge";
import { studioProjectSlug } from "@/lib/project-path";

export type Theme = "light" | "dark";

const DEFAULT_AGENT_ID = "opencode";
const FALLBACK_PROJECT_KEY = "default";
export const DEFAULT_CHAT_MODE: NonNullable<AgentSetting["mode"]> = "design";

/** Persisted per-agent selections for one studio project. */
export interface AgentSetting {
  /**
   * Last ACP session id from the server. `null` until picked or created.
   * Only written when `caps.agentCapabilities.loadSession` is true (ACP).
   */
  id: string | null;
  /** ACP model id (see agent caps). */
  model?: string;
  /**
   * Studio chat mode: `agent` (main codebase) or `design` (prototype folder).
   * Defaults to {@link DEFAULT_CHAT_MODE} when unset.
   */
  mode?: "agent" | "design";
  /**
   * Optional explicit design-folder override (prototype id under
   * `.dddx/designs`). When unset, the server picks the write target from
   * `mode` and attached plugin context.
   */
  workspace?: string;
}

/** Last-selected image generation provider and model (global user prefs). */
export interface ImagePrefs {
  provider?: string;
  modelId?: string;
}

/** Persisted layout for one design workspace (`canvas.json` shape). */
export type CanvasDocument = {
  nodes: Record<string, { x: number; y: number }>;
  /** File paths in left-to-right flow order. */
  order: string[];
};

/** Per-project agent selection persisted under {@link StudioStore.projects}. */
export interface ProjectAgentState {
  /** Active agent id from the registry. */
  id: string;
  /** Per-agent persisted prefs. */
  settings: Record<string, AgentSetting>;
  /** Design canvas layouts keyed by workspace id. */
  canvas: Record<string, CanvasDocument>;
}

export interface AgentActions {
  select: (agent: string) => void;
  ensureSetting: (agent: string) => AgentSetting;
  setSessionId: (agent: string, id: string | null) => void;
  /** Clear remembered session id for `agent`. */
  resetSession: (agent: string) => void;
  setPrefs: (
    agent: string,
    patch: {
      model?: string;
      mode?: "agent" | "design";
      workspace?: string;
    },
  ) => void;
}

export interface UISlice {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  maximized: boolean;
  setMaximized: (maximized: boolean) => void;
  toggleMaximized: () => void;
  panel: string | null;
  setPanel: (panelId: string | null) => void;
}

export interface ExtensionSlice {
  /** Active preview extension ids (multiple allowed). */
  active: string[];
  setActive: (id: string, enabled: boolean) => void;
  toggle: (id: string) => void;
  isActive: (id: string) => boolean;
}

export interface ImageSlice {
  prefs: ImagePrefs;
  setPrefs: (patch: Partial<ImagePrefs>) => void;
}

export interface CanvasActions {
  save: (id: string, doc: CanvasDocument) => void;
  remove: (id: string) => void;
}

export interface StudioStore {
  /** Agent prefs keyed by project slug (`/p/<slug>`). */
  projects: Record<string, ProjectAgentState>;
  /** Agent mutations scoped to the current project slug. */
  agent: AgentActions;
  canvas: CanvasActions;
  ui: UISlice;
  extension: ExtensionSlice;
  image: ImageSlice;
}

type PersistedStudioStore = {
  projects?: Record<string, ProjectAgentState>;
  ui?: Pick<UISlice, "theme" | "maximized">;
  extension?: Pick<ExtensionSlice, "active">;
  image?: Pick<ImageSlice, "prefs">;
};

type StudioStorePersisted = {
  projects: Record<string, ProjectAgentState>;
  ui: Pick<UISlice, "theme" | "maximized">;
  extension: Pick<ExtensionSlice, "active">;
  image: Pick<ImageSlice, "prefs">;
};

type StudioStoreWithPersist = UseBoundStore<StoreApi<StudioStore>> & {
  persist: {
    setOptions: (
      options: Partial<PersistOptions<StudioStore, StudioStorePersisted>>,
    ) => void;
    clearStorage: () => void;
    rehydrate: () => Promise<void> | void;
    hasHydrated: () => boolean;
    onHydrate: (fn: (state: StudioStore) => void) => () => void;
    onFinishHydration: (fn: (state: StudioStore) => void) => () => void;
    getOptions: () => Partial<
      PersistOptions<StudioStore, StudioStorePersisted>
    >;
  };
};

function emptySetting(): AgentSetting {
  return { id: null, mode: DEFAULT_CHAT_MODE };
}

function defaultProjectAgent(): ProjectAgentState {
  return { id: DEFAULT_AGENT_ID, settings: {}, canvas: {} };
}

/** Active project slug from the studio URL, or `"default"` when unset. */
export function currentProjectSlug(): string {
  return studioProjectSlug() || FALLBACK_PROJECT_KEY;
}

function ensureProjectDraft(
  draft: StudioStore,
  slug: string,
): ProjectAgentState {
  if (!draft.projects[slug]) {
    draft.projects[slug] = defaultProjectAgent();
  } else if (!draft.projects[slug].canvas) {
    draft.projects[slug].canvas = {};
  }
  return draft.projects[slug];
}

const detectInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const studioStoreCreator = immer<StudioStore>((set, get) => ({
  projects: {},

  extension: {
    active: ["shadcn"],

    isActive: (id) => get().extension.active.includes(id),

    setActive: (id, enabled) => {
      const was = get().extension.active.includes(id);
      if (enabled === was) return;

      set((draft) => {
        if (enabled) {
          if (!draft.extension.active.includes(id)) {
            draft.extension.active.push(id);
          }
        } else {
          draft.extension.active = draft.extension.active.filter(
            (activeId) => activeId !== id,
          );
        }
      });

      void sync(id, enabled);
    },

    toggle: (id) => {
      get().extension.setActive(id, !get().extension.isActive(id));
    },
  },

  canvas: {
    save: (id, doc) =>
      set((draft) => {
        ensureProjectDraft(draft, currentProjectSlug()).canvas[id] = doc;
      }),

    remove: (id) =>
      set((draft) => {
        delete ensureProjectDraft(draft, currentProjectSlug()).canvas[id];
      }),
  },

  agent: {
    select: (agent) =>
      set((draft) => {
        const project = ensureProjectDraft(draft, currentProjectSlug());
        if (!project.settings[agent]) {
          project.settings[agent] = emptySetting();
        }
        project.id = agent;
      }),

    ensureSetting: (agent) => {
      const slug = currentProjectSlug();
      const existing = get().projects[slug]?.settings[agent];
      if (existing) return existing;
      const row = emptySetting();
      set((draft) => {
        ensureProjectDraft(draft, slug).settings[agent] = row;
      });
      return row;
    },

    setSessionId: (agent, id) =>
      set((draft) => {
        const project = ensureProjectDraft(draft, currentProjectSlug());
        if (!project.settings[agent]) {
          project.settings[agent] = emptySetting();
        }
        project.settings[agent].id = id;
      }),

    resetSession: (agent) =>
      set((draft) => {
        const project = ensureProjectDraft(draft, currentProjectSlug());
        if (!project.settings[agent]) {
          project.settings[agent] = emptySetting();
        } else {
          project.settings[agent].id = null;
        }
      }),

    setPrefs: (agent, patch) =>
      set((draft) => {
        const project = ensureProjectDraft(draft, currentProjectSlug());
        if (!project.settings[agent]) {
          project.settings[agent] = emptySetting();
        }
        const row = project.settings[agent];
        if (patch.model !== undefined) row.model = patch.model;
        if (patch.mode !== undefined) row.mode = patch.mode;
        if (patch.workspace !== undefined) row.workspace = patch.workspace;
      }),
  },

  ui: {
    theme: detectInitialTheme(),
    setTheme: (theme) =>
      set((draft) => {
        draft.ui.theme = theme;
      }),
    toggleTheme: () =>
      set((draft) => {
        draft.ui.theme = draft.ui.theme === "dark" ? "light" : "dark";
      }),
    maximized: false,
    setMaximized: (maximized) =>
      set((draft) => {
        draft.ui.maximized = maximized;
      }),
    toggleMaximized: () =>
      set((draft) => {
        draft.ui.maximized = !draft.ui.maximized;
      }),
    panel: null,
    setPanel: (panelId) =>
      set((draft) => {
        draft.ui.panel = panelId;
      }),
  },

  image: {
    prefs: {},

    setPrefs: (patch) =>
      set((draft) => {
        if (patch.provider !== undefined) {
          draft.image.prefs.provider = patch.provider;
        }
        if (patch.modelId !== undefined) {
          draft.image.prefs.modelId = patch.modelId;
        }
      }),
  },
}));

export const useStudioStore = create<StudioStore>()(
  persist(studioStoreCreator as unknown as StateCreator<StudioStore, [], []>, {
    name: "dddx",
    version: 1,
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({
      projects: s.projects,
      ui: { theme: s.ui.theme, maximized: s.ui.maximized },
      extension: { active: s.extension.active },
      image: { prefs: s.image.prefs },
    }),
    merge: (persisted, current) =>
      merge(current, (persisted ?? {}) as PersistedStudioStore) as StudioStore,
  }),
) as StudioStoreWithPersist;

/** Active agent id for the current project. */
export function useCurrentAgentId(): string {
  const slug = currentProjectSlug();
  return useStudioStore((s) => s.projects[slug]?.id ?? DEFAULT_AGENT_ID);
}

/** Active agent’s persisted row for the current project (`id` = last session id). */
export function useCurrentAgentSetting(): AgentSetting {
  const slug = currentProjectSlug();
  const agentId = useStudioStore(
    (s) => s.projects[slug]?.id ?? DEFAULT_AGENT_ID,
  );
  const row = useStudioStore((s) => s.projects[slug]?.settings[agentId]);
  const ensureSetting = useStudioStore((s) => s.agent.ensureSetting);
  return row ?? ensureSetting(agentId);
}

/** Last-selected image provider and model for the generate panel. */
export function useImageGenerationPrefs(): ImagePrefs {
  return useStudioStore((s) => s.image.prefs);
}

export function useApplyStudioTheme(): void {
  const theme = useStudioStore((s) => s.ui.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
}

/** Replay persisted active extensions into the preview after store hydration. */
export function useReplayExtensionsOnHydrate(): void {
  useEffect(() => {
    const replayExts = () => {
      const ids = useStudioStore.getState().extension.active;
      void replayExt(ids);
    };
    if (useStudioStore.persist.hasHydrated()) replayExts();
    return useStudioStore.persist.onFinishHydration(replayExts);
  }, []);
}

export function useStudioStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState<boolean>(() =>
    useStudioStore.persist.hasHydrated(),
  );
  useEffect(() => {
    const unsubFinish = useStudioStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    const unsubStart = useStudioStore.persist.onHydrate(() =>
      setHydrated(false),
    );
    if (useStudioStore.persist.hasHydrated()) setHydrated(true);
    return () => {
      unsubFinish();
      unsubStart();
    };
  }, []);
  return hydrated;
}

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { DddxProvider, api } from "./client.tsx";
import { PromptContextProvider } from "./components/prompt-context-provider.tsx";
import { StudioLoading } from "./components/studio-loading.tsx";
import { unmountLoading } from "./loading.ts";
import App from "./app-v2.tsx";

// Side-effect import: downstream bundlers process this as regular CSS and
// merge it into the host page's stylesheet. The SDK's own build script
// replaces this module's contents with a script that sets
// `window.dddx.styles` so the shadow-DOM host below can still inject a
// scoped copy of the compiled Tailwind output.
import "./styles.css";

export interface MountStudioOptions {
  /**
   * Mount target. Defaults to `#root`; when no target is provided and no
   * `#root` exists, the host rewrites `document.documentElement` with a
   * minimal shell and mounts into that new `#root` element.
   */
  target?: HTMLElement;
}

export function mountStudio(options: MountStudioOptions = {}) {
  let target = options.target ?? document.getElementById("root") ?? undefined;

  if (!target) return;

  createRoot(target).render(
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <DddxProvider>
          <PromptContextProvider>
            <Routes>
              <Route path="/p/:slug" element={<StudioGate />} />
              <Route
                path="*"
                element={
                  <StudioLoading
                    status="error"
                    error="Open studio at /p/<project-slug>"
                  />
                }
              />
            </Routes>
          </PromptContextProvider>
        </DddxProvider>
      </BrowserRouter>
    </MotionConfig>,
  );
}

/**
 * Gates the canvas on `/p/:slug`. Renders the loading UI until the
 * tRPC `project.current` query resolves for the URL slug, then mounts
 * the App keyed by `project.id` so per-project persisted agent state
 * is read for that slug.
 */
export function StudioGate() {
  const { slug } = useParams<{ slug: string }>();
  const utils = api.useUtils();
  const prevSlug = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    if (prevSlug.current !== undefined && prevSlug.current !== slug) {
      void utils.invalidate();
    }
    prevSlug.current = slug;
  }, [slug, utils]);

  const projectQuery = api.project.current.useQuery(undefined, {
    enabled: Boolean(slug),
  });

  if (projectQuery.isError) {
    return (
      <StudioLoading
        status="error"
        error={projectQuery.error?.message ?? "Connection error"}
      />
    );
  }
  unmountLoading();

  const project = projectQuery.data?.project;
  // Only gate on missing or mismatched project identity. Background refetches
  // (e.g. refetchOnWindowFocus when returning to the tab) set isFetching but
  // should not unmount the studio.
  const switching = Boolean(slug) && (!project || project.id !== slug);

  if (switching) {
    return <StudioLoading status="loading" error={null} />;
  }

  if (!project) {
    return null;
  }

  return <App key={project.id} />;
}

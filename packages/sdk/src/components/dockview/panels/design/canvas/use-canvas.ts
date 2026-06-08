import { useCallback, useEffect, useRef, useState } from "react";
import { useNodesInitialized, useReactFlow, type Node } from "@xyflow/react";
import { skipToken } from "@tanstack/react-query";

import { api } from "@/client";
import { useDesignFileEvents } from "@/hooks/use-design-file-events";
import { useLatest } from "@/hooks/use-latest";
import { CustomEventEnum, listen } from "@/lib/custom-event";
import { resolveBusyFramePaths } from "@/lib/design-canvas-files";

import { FIT_OPTS } from "./layout";
import { canvasStorage } from "./canvas-storage";
import {
  bumpNodePreviewSrc,
  documentFromNodes,
  syncCanvasNodes,
  withActivity,
} from "./sync-canvas-nodes";

type Busy = Map<string, "creating" | "updating">;
type Fit = { animate: boolean; ids?: string[] };

/** Owns canvas nodes: file→node sync, busy state, watching, and fit-view. */
export function useCanvas(
  active: string | undefined,
  /** Agent write target during a design stream; file events follow this, not `active`. */
  agentWorkspace: string | null = null,
) {
  const utils = api.useUtils();
  const watchWorkspace = agentWorkspace ?? active;

  const query = api.project.designs.get.useQuery(
    active ? { id: active } : skipToken,
  );

  const [nodes, setNodes] = useState<Node[]>([]);
  const [busy, setBusy] = useState<Busy>(new Map());
  const [watch, setWatch] = useState(false);
  const [fit, setFit] = useState<Fit | null>(null);

  const { fitView } = useReactFlow();
  const ready = useNodesInitialized();
  const nodesRef = useLatest(nodes);
  const busyRef = useLatest(busy);
  const prevWs = useRef<string | undefined>(undefined);
  const force = useRef(false);
  const gen = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setBusy(new Map());
    setFit(null);
  }, [active]);

  useEffect(() => {
    setBusy(new Map());
  }, [watchWorkspace]);

  useEffect(
    () =>
      listen<boolean>(CustomEventEnum.DesignWatchActive, (event) => {
        setWatch(!!event.detail);
      }),
    [],
  );

  const framePathsRef = useLatest(
    query.data?.files
      .filter((f) => (f.kind ?? "html") === "html")
      .map((f) => f.path) ?? [],
  );

  const mark = useCallback(
    (path: string, type: "add" | "change" | "unlink") => {
      const targets = resolveBusyFramePaths(path, framePathsRef.current);
      if (!targets.length) return;

      setBusy((prev) => {
        const next = new Map(prev);
        for (const target of targets) {
          if (type === "unlink") next.delete(target);
          else {
            const direct =
              target.toLowerCase() === path.toLowerCase();
            next.set(
              target,
              direct && type === "add" ? "creating" : "updating",
            );
          }
        }
        return next;
      });
      if (type === "change") {
        setNodes((prev) =>
          targets.reduce((nodes, target) => bumpNodePreviewSrc(nodes, target), prev),
        );
      }
    },
    [framePathsRef],
  );

  const connected = useDesignFileEvents({
    enabled: watch && !!watchWorkspace,
    id: watchWorkspace,
    onFilesChanged: () => {
      if (watchWorkspace === active) {
        void query.refetch();
        return;
      }
      if (watchWorkspace) {
        void utils.project.designs.get.invalidate({ id: watchWorkspace });
      }
    },
    onFileEvent: ({ path, type }) => mark(path, type),
    onWatcherEnded: () => setBusy(new Map()),
  });

  useEffect(() => {
    setNodes((prev) => withActivity(prev, busy));
  }, [busy]);

  useEffect(() => {
    const id = ++gen.current;
    let dead = false;
    const changed = prevWs.current !== active;
    const forced = force.current;
    force.current = false;

    void (async () => {
      const result = await syncCanvasNodes({
        data: query.data,
        prev: nodesRef.current,
        activeWs: active,
        storage: canvasStorage,
        forceLayout: forced,
        fileBusy: busyRef.current,
        workspaceChanged: changed,
      });
      if (dead || id !== gen.current) return;

      setNodes(result.nodes);
      if (result.nodes.length) prevWs.current = active;

      if (result.fitAll && result.nodes.length) setFit({ animate: changed });
      else if (result.newNodeIds.length)
        setFit({ animate: true, ids: result.newNodeIds });
    })();

    return () => {
      dead = true;
    };
  }, [query.data, active, tick]);

  useEffect(() => {
    if (!fit || !ready || !nodes.length) return;
    const focus = fit.ids ? nodes.filter((n) => fit.ids!.includes(n.id)) : null;
    fitView({
      ...FIT_OPTS,
      ...(focus?.length ? { nodes: focus } : {}),
      duration: fit.animate ? FIT_OPTS.duration : 0,
    });
    setFit(null);
  }, [fit, ready, nodes, fitView]);

  const relayout = useCallback(() => {
    force.current = true;
    setTick((t) => t + 1);
  }, []);

  const focus = useCallback(
    (ids: string[]) => setFit({ animate: true, ids }),
    [],
  );

  const save = useCallback(() => {
    if (active) canvasStorage.save(active, documentFromNodes(nodesRef.current));
  }, [active, nodesRef]);

  return {
    nodes,
    setNodes,
    /** SSE open (or draining after stream). */
    watch: connected,
    /** Agent design stream in progress (`DesignWatchActive`). */
    agentWatch: watch,
    relayout,
    focus,
    save,
    refetch: query.refetch,
  };
};

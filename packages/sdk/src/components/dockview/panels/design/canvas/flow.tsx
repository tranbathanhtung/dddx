import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  SelectionMode,
  Panel,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";

import { usePromptContext } from "@/components/prompt-context-provider";
import {
  frameContextFromNode,
  frameContextId,
  isFrameContextId,
} from "@/components/frame-context";
import { CustomEventEnum, dispatch } from "@/lib/custom-event";
import { WorkspaceSelector } from "@/components/agent-elements/input/workspace-selector";
import {
  defaultImageGenerateConfig,
  useImageGenerationCatalog,
} from "@/lib/image-generation";
import { useImageGenerationPrefs } from "@/store";

import { FIT_OPTS, placeNodeBesideLast } from "./layout";
import {
  canvasNodeTypes,
  isCanvasNodeType,
  isGenerateNode,
  makeGenerateImageNode,
} from "./nodes";
import { CanvasToolbar, type Tool } from "./toolbar";
import { Spotlight } from "./spotlight";
import { ZoomMenu } from "./zoom";
import { CanvasEmpty } from "./empty";
import { Fullscreen } from "./fullscreen";
import { AgentPill } from "./agent-pill";
import { useTools } from "./use-tools";
import { VariantsPanel, type VariantsPanelTarget } from "./variants-panel";
import { useWorkspaces } from "./use-workspaces";
import { useCanvas } from "./use-canvas";
import { useEvents } from "./use-events";

export const Flow = memo(function Flow() {
  const { customContexts, setCustomContexts } = usePromptContext();
  const ws = useWorkspaces();
  const [agentWs, setAgentWs] = useState<string | null>(null);
  const canvas = useCanvas(ws.active, agentWs);
  const { nodes, setNodes, focus } = canvas;

  const rf = useReactFlow();
  const [edges, setEdges] = useState<Edge[]>([]);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [fullId, setFullId] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantsPanelTarget | null>(null);
  const annotating = useRef(false);

  /** Nodes with live/interactive/draggable derived from `liveId` — no effects. */
  const live = useMemo(
    () =>
      nodes.map((node) => {
        const isLive = node.id === liveId;
        const interactive = isLive || isGenerateNode(node);
        return {
          ...node,
          draggable: !isLive,
          data:
            node.data.__interactive === interactive
              ? node.data
              : { ...node.data, __interactive: interactive },
        };
      }),
    [nodes, liveId],
  );

  const syncFrames = useCallback(
    (selected: Node[]) => {
      const frames = selected.filter(
        (n) =>
          isCanvasNodeType(n.type) &&
          !isGenerateNode(n) &&
          !(n.data as { imageEdit?: unknown })?.imageEdit,
      );
      const ids = new Set(frames.map((n) => frameContextId(n.id)));

      setCustomContexts((prev) => {
        const kept = prev.filter(
          (ctx) => !isFrameContextId(ctx.id) || ids.has(ctx.id),
        );
        const have = new Set(kept.map((c) => c.id));
        const add = frames
          .filter((n) => !have.has(frameContextId(n.id)))
          .map((n) => frameContextFromNode(n));
        if (!add.length && kept.length === prev.length) return prev;
        return [...kept, ...add];
      });
    },
    [setCustomContexts],
  );

  const frameContextIds = useMemo(
    () =>
      new Set(
        customContexts
          .filter((ctx) => isFrameContextId(ctx.id))
          .map((ctx) => ctx.id),
      ),
    [customContexts],
  );

  /** Deselect canvas frames when their context chip is removed from the prompt. */
  useEffect(() => {
    setNodes((prev) => {
      let changed = false;
      const next = prev.map((node) => {
        if (!node.selected) return node;
        if (!isCanvasNodeType(node.type) || isGenerateNode(node)) return node;
        if ((node.data as { imageEdit?: unknown })?.imageEdit) return node;
        if (frameContextIds.has(frameContextId(node.id))) return node;
        changed = true;
        return { ...node, selected: false };
      });
      return changed ? next : prev;
    });
  }, [frameContextIds, setNodes]);

  useEffect(() => {
    setLiveId(null);
    setFullId(null);
    setVariants(null);
    syncFrames([]);
  }, [ws.active, syncFrames]);

  useEvents({
    onAgentWs: (id) => {
      setAgentWs(id);
      if (id) {
        ws.setWs(id);
        void ws.refetch();
      }
    },
    onVariants: (nodeId) => {
      const node = rf.getNode(nodeId);
      if (node) setVariants({ nodeId, label: String(node.data?.label ?? "Screen") });
    },
    onImage: ({ nodeId, replace }) => {
      if (!nodeId) return;
      if (!replace) setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      void canvas.refetch();
    },
    onSend: ({ nodeId, text, mode }) => {
      const node = nodeId ? rf.getNode(nodeId) : undefined;
      const body = text?.trim();
      if (!node || !body) return;
      dispatch(CustomEventEnum.DesignCanvasAgentSend, {
        detail: {
          text: body,
          contexts: [frameContextFromNode(node)],
          mode,
        },
      });
    },
  });

  const clearLive = useCallback(() => {
    if (annotating.current) return;
    setFullId(null);
    setLiveId(null);
  }, []);

  const empty = ws.ready && ws.options.length === 0;

  const { tool, setTool, isPan, uploadInputRef, onUpload, onUploadChange, uploadOff } =
    useTools({
      onEscape: clearLive,
      workspaceId: ws.active,
      uploadBlocked: empty,
      onUploaded: () => void canvas.refetch(),
    });

  const catalog = useImageGenerationCatalog();
  const prefs = useImageGenerationPrefs();
  const pendingImg = useRef(false);

  const addImage = useCallback(() => {
    if (!ws.active || !catalog.data) return false;
    const node = makeGenerateImageNode({
      workspaceId: ws.active,
      config: defaultImageGenerateConfig(catalog.data, prefs),
    });
    setNodes((prev) => [
      ...prev.map((n) => ({ ...n, selected: false })),
      { ...node, position: placeNodeBesideLast(prev, node), selected: true },
    ]);
    focus([node.id]);
    return true;
  }, [ws.active, catalog.data, prefs, setNodes, focus]);

  const onTool = useCallback(
    (next: Tool) => {
      if (next === "layout") {
        canvas.relayout();
        setTool("select");
        return;
      }
      if (next === "image") {
        if (addImage()) setTool("select");
        else pendingImg.current = true;
        return;
      }
      pendingImg.current = false;
      setTool(next);
    },
    [addImage, canvas, setTool],
  );

  useEffect(() => {
    if (!pendingImg.current || !addImage()) return;
    pendingImg.current = false;
    setTool("select");
  }, [addImage, setTool]);

  const agentName = useMemo(() => {
    if (!agentWs) return null;
    return ws.options.find((w) => w.id === agentWs)?.name ?? agentWs;
  }, [agentWs, ws.options]);

  const fullNode = useMemo(() => nodes.find((n) => n.id === fullId), [nodes, fullId]);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof applyNodeChanges>[0]) => {
      setNodes((prev) => applyNodeChanges(changes, prev));
      if (changes.some((c) => c.type === "position" && c.dragging === false)) {
        canvas.save();
      }
    },
    [setNodes, canvas],
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof applyEdgeChanges>[0]) =>
      setEdges((e) => applyEdgeChanges(changes, e)),
    [],
  );

  const onConnect = useCallback(
    (params: Parameters<typeof addEdge>[0]) => setEdges((e) => addEdge(params, e)),
    [],
  );

  const onDouble = useCallback((_: unknown, node: Node) => {
    if (!isGenerateNode(node)) setFullId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setLiveId(null);
    setVariants(null);
  }, []);

  const jumpAgent = useCallback(() => {
    if (!agentWs) return;
    ws.setWs(agentWs);
    const ids = nodes
      .filter((n) => (n.data as { workspaceId?: string })?.workspaceId === agentWs)
      .map((n) => n.id);
    if (ids.length) focus(ids);
  }, [agentWs, nodes, focus, ws]);

  const onCreate = useCallback(
    (name?: string | null) => {
      if (name?.trim()) ws.create.mutate({ name: name.trim() });
    },
    [ws.create],
  );

  return (
    <div className="relative h-full w-full">
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        aria-hidden
        onChange={onUploadChange}
      />
      <ReactFlow
        nodes={live}
        edges={edges}
        nodeTypes={canvasNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onDouble}
        onPaneClick={onPaneClick}
        onSelectionChange={({ nodes: sel }) => syncFrames(sel)}
        onlyRenderVisibleElements
        deleteKeyCode={["Backspace", "Delete"]}
        fitViewOptions={FIT_OPTS}
        minZoom={0.02}
        proOptions={{ hideAttribution: true }}
        panOnDrag={isPan}
        selectionOnDrag={!isPan}
        selectionMode={SelectionMode.Partial}
        selectionKeyCode={null}
        multiSelectionKeyCode={["Shift"]}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        nodesDraggable={!isPan}
        nodesConnectable={!isPan}
        elementsSelectable={!isPan}
        className={isPan ? "cursor-grab" : ""}
      >
        <ZoomMenu />
        <CanvasToolbar
          tool={tool}
          onTool={onTool}
          onUpload={onUpload}
          uploadOff={uploadOff}
          imageOff={empty || !ws.active}
        />
        {canvas.agentWatch && agentName ? (
          <AgentPill name={agentName} onJump={jumpAgent} />
        ) : null}
        {ws.options.length > 0 ? (
          <Panel position="top-right">
            <WorkspaceSelector
              workspaces={ws.options}
              value={ws.active}
              onChange={ws.setWs}
              onCreate={onCreate}
              agentActiveId={canvas.agentWatch ? agentWs : null}
              variant="outline"
            />
          </Panel>
        ) : null}
        {!empty && <Spotlight />}
      </ReactFlow>
      {variants ? (
        <div className="pointer-events-none absolute inset-y-0 right-4 z-20 flex items-center">
          <div className="pointer-events-auto">
            <VariantsPanel target={variants} onClose={() => setVariants(null)} />
          </div>
        </div>
      ) : null}
      {empty && <CanvasEmpty onCreate={onCreate} pending={ws.create.isPending} />}
      {fullNode ? (
        <Fullscreen
          node={fullNode}
          onClose={() => setFullId(null)}
          onAnnotatingChange={(active) => {
            annotating.current = active;
          }}
        />
      ) : null}
    </div>
  );
});

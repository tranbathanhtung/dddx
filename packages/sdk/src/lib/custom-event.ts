export enum CustomEventEnum {
  OpenTemplatePreview = "open-template-preview",
  OpenDockPanel = "open-dock-panel",
  /** Emitted while a design-workspace chat turn is in flight (drives canvas file SSE). */
  DesignWatchActive = "design-watch-active",
  /** Announces which design workspace the agent is writing to this turn. */
  DesignWorkspaceActive = "design-workspace-active",
  /** Opens the canvas variants form for a selected node. */
  DesignCanvasOpenVariants = "design-canvas-open-variants",
  /** Canvas node action requesting an agent message (enriched in flow). */
  DesignCanvasRequestSend = "design-canvas-request-send",
  /** Sends a prompt to the sidebar agent chat. */
  DesignCanvasAgentSend = "design-canvas-agent-send",
  /** A generate-image node finished and saved a file to the design workspace. */
  DesignCanvasImageGenerated = "design-canvas-image-generated",
}

export const dispatch = <T>(
  type: CustomEventEnum,
  options?: { detail?: T },
) => {
  window.dispatchEvent(new CustomEvent<T>(type, options));
};

export const listen = <T>(
  type: CustomEventEnum,
  callback: (event: CustomEvent<T>) => void,
) => {
  const listener = callback as EventListener;
  window.addEventListener(type, listener);

  return () => {
    window.removeEventListener(type, listener);
  };
};

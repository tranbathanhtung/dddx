export {
  addAttachment,
  countProjectAttachments,
  hasAttachment,
  isPidRunning,
  liveAttachments,
  removeAttachment,
  type StudioAttachment,
  type StudioRegistry,
} from "./attachments";

export {
  attachStudioServer,
  clearRegistryIfOwned,
  DEFAULT_STUDIO_PORT,
  killStudioWorkerSync,
  listActiveStudioProjects,
  probeStudioHealth,
  reconcileRegistry,
  registerPreviewTargets,
  resolveStudioPort,
  STUDIO_SERVICE,
  studioUrl,
  workerExecArgv,
  type ActiveStudioProject,
  type StudioHandle,
} from "./registry";

export {
  clearPreviewTargets,
  getPreviewTargets,
  setPreviewTargets,
  type PreviewTarget,
} from "./preview";

export { resolveProjectDirFromSlug } from "./slug";

export {
  createStudioSessionManager,
  type StudioSessionManager,
  type StudioSessionManagerOptions,
} from "./session";

export {
  createStudioApp,
  startStudioServer,
  startStudioServerInProcess,
  type Options as StudioServerOptions,
} from "./app";

export { runStudioWorker } from "./worker";

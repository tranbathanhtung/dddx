export type { Ext, ExtLogoProps } from "./types";

export { get, list, extensions } from "./registry";

export { inject, dispose, click } from "./bridge";
export {
  inject as injectExtension,
  dispose as disposeExtension,
  click as clickExtension,
} from "./bridge";

export { sync, replay } from "./sync";
export { sync as syncExtension } from "./sync";

export { useActive, useActiveIds, replayActive } from "./active";
export {
  useActive as useActiveExtensions,
  useActiveIds as useActiveExtensionIds,
} from "./active";

export {
  ActiveButtons,
  ExtMenu,
  ActiveExtensionButtons,
  ExtensionsMenu,
} from "./ui/menu";

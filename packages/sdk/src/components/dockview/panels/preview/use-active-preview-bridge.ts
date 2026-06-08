import { useEffect } from "react";
import type { IDockviewPanelProps } from "dockview-react";

import {
  getActiveBridgeId,
  setActiveBridge,
} from "@/components/dockview/panels/preview/bridge-registry";

/** Route extension commands to whichever preview panel tab is active. */
export function useActivePreviewBridge(
  panelApi: IDockviewPanelProps["api"],
) {
  useEffect(() => {
    const sync = () => {
      if (panelApi.isActive) {
        setActiveBridge(panelApi.id);
        return;
      }
      if (getActiveBridgeId() === panelApi.id) {
        setActiveBridge(null);
      }
    };

    sync();
    const disposable = panelApi.onDidActiveChange(sync);
    return () => {
      disposable.dispose();
      if (getActiveBridgeId() === panelApi.id) {
        setActiveBridge(null);
      }
    };
  }, [panelApi]);
}

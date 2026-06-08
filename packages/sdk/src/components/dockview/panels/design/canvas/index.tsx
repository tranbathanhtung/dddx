import { memo } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Flow } from "./flow";

export { FIT_PAD, FIT_OPTS } from "./layout";
export {
  makeNode,
  makeGenerateImageNode,
  previewUrl,
  type NodeInput,
} from "./nodes";

export const Canvas = memo(function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
});

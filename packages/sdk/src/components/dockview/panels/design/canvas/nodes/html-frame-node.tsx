import { IconPhoto } from "@tabler/icons-react";

import { createFrameNode } from "./create-frame-node";
import { HtmlNode, HtmlNodeToolbar } from "./html-node";
import { kindIcon } from "./kind-icon";

export const HtmlFrameNode = createFrameNode({
  Content: HtmlNode,
  icon: (data) => kindIcon("html", data.framePreset),
  toolbarExtra: ({ id, data, selected }) =>
    selected ? <HtmlNodeToolbar nodeId={id} label={data.label} /> : null,
});

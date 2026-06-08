import scriptTemplate from "./script.js" with { type: "text" };
import themes from "./themes.json";

import type { Ext, ExtLogoProps } from "../types";

const script = (scriptTemplate as string).replace(
  "/*__THEMES__*/",
  "var THEMES = " + JSON.stringify(themes) + ";",
);

export const shadcn: Ext = {
  id: "shadcn",
  name: "shadcn",
  logo: ({ className }: ExtLogoProps) => (
    <img
      className={className}
      src="https://avatars.githubusercontent.com/u/139895814?s=200&v=4"
      alt=""
    />
  ),
  script,
};

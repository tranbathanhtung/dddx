// TODO: Implement this extension
import type { Ext, ExtLogoProps } from "../types";

export const reactScan: Ext = {
  id: "react-scan",
  name: "react-scan",
  logo: ({ className }: ExtLogoProps) => (
    <img className={className} src="https://react-scan.com/logo.svg" alt="" />
  ),
  script: "",
};

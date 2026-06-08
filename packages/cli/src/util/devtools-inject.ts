import { Sdk } from "./sdk-origin.ts";
import { localDevHostnameCheckJs } from "./service-endpoints.ts";

const devtoolsUrl = Sdk.asset("devtools.js");

/** Injected into HTML served in dev so iframe pages can load Agentation. */
export const DEVTOOLS_SCRIPT_TAG = `<script>
if (${localDevHostnameCheckJs()}) {
  const s = document.createElement("script");
  s.src = ${JSON.stringify(devtoolsUrl)};
  s.type = "module";
  document.head.appendChild(s);
}
</script>`;

export function injectDevtoolsHtml(html: string): string {
  return html.includes("</head>")
    ? html.replace("</head>", `${DEVTOOLS_SCRIPT_TAG}\n</head>`)
    : `${DEVTOOLS_SCRIPT_TAG}\n${html}`;
}

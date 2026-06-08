import { boot } from "./init";

export type { ParentApi } from "./types";
export type { ChildApi } from "./api";

console.log("devtools loaded");

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

import { createApi } from "./api";
import { bindErrors } from "./errors";
import { bindLink } from "./link";
import { mount } from "./mount";
import { nav, watchUrl } from "./nav";

export function boot() {
  try {
    sessionStorage.removeItem("agentation-session-toolbar-hidden");
  } catch {
    // ignore
  }

  const api = createApi();
  let emitUrl = () => {};
  const { getParent } = bindLink(api, () => emitUrl());
  emitUrl = watchUrl(getParent);

  mount(getParent);
  bindErrors();

  return api;
}

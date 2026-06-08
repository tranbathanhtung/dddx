import { ensureHost, setExtId } from "./host";
import { extStore } from "./store";

function scriptId(id: string) {
  return `dddx-extension-${id}`;
}

export function inject(id: string, source: string) {
  dispose(id);
  ensureHost();
  extStore.set(id, {});

  setExtId(id);
  try {
    const el = document.createElement("script");
    el.id = scriptId(id);
    el.textContent = source.trim();
    document.body.appendChild(el);
    // el.remove();
  } catch (error) {
    console.error(`[dddx] extension "${id}" failed:`, error);
    extStore.delete(id);
  } finally {
    setExtId(undefined);
  }
}

export function dispose(id: string) {
  extStore.get(id)?.dispose?.();
  extStore.delete(id);
  document.getElementById(scriptId(id))?.remove();
}

export function click(id: string) {
  extStore.get(id)?.onClick?.();
}

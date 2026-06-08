import { extStore } from "./store";

export function ensureHost() {
  const dddx = (window.dddx ??= {});
  if (dddx.action && dddx.extension) return;

  dddx.action = {
    onClicked(fn: () => void) {
      const id = dddx.extId;
      if (!id) return;
      const row = extStore.get(id) ?? {};
      row.onClick = fn;
      extStore.set(id, row);
    },
  };
  dddx.extension = {
    onDispose(fn: () => void) {
      const id = dddx.extId;
      if (!id) return;
      const row = extStore.get(id) ?? {};
      row.dispose = fn;
      extStore.set(id, row);
    },
  };
}

export function setExtId(id: string | undefined) {
  const dddx = (window.dddx ??= {});
  if (id) dddx.extId = id;
  else delete dddx.extId;
}

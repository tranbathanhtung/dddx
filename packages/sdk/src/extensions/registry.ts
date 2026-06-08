import { shadcn } from "./shadcn";
import type { Ext } from "./types";

export const list: Ext[] = [shadcn];

export function get(id: string) {
  return list.find((ext) => ext.id === id);
}

/** @deprecated Use {@link list} */
export const extensions = list;

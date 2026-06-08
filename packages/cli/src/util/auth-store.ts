import path from "path";

import { Global } from "@/util/global";
import { Filesystem } from "@/util/filesystem";

export type AuthProviderId = "gateway" | "openrouter";

export type AuthEntry = {
  type: "api";
  key: string;
};

export type AuthFile = Partial<Record<AuthProviderId, AuthEntry>>;

const authPath = () => path.join(Global.Path.app, "auth.json");

export async function readAuthFile(): Promise<AuthFile> {
  const file = authPath();
  if (!(await Filesystem.exists(file))) return {};
  try {
    const data = await Filesystem.readJson<AuthFile>(file);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export async function getAuthKey(
  provider: AuthProviderId,
): Promise<string | undefined> {
  const entry = (await readAuthFile())[provider];
  const key = entry?.key?.trim();
  return key || undefined;
}

export async function setAuthKey(
  provider: AuthProviderId,
  key: string,
): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error("API key is required");
  }
  const file = authPath();
  const current = await readAuthFile();
  current[provider] = { type: "api", key: trimmed };
  await Filesystem.writeJson(file, current);
}

export async function removeAuthKey(provider: AuthProviderId): Promise<void> {
  const file = authPath();
  const current = await readAuthFile();
  delete current[provider];
  await Filesystem.writeJson(file, current);
}

export function maskAuthKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

import type { UIMessage } from "ai";

import { buildTurnReminder } from "@/prompt";
import { MAIN_FOLDER_ID, Workspace } from "@/util/workspace";

export type Mode = "agent" | "design";

export namespace Turn {
  export function normalizeMode(value: unknown): Mode | undefined {
    if (value === "agent" || value === "design") return value;
    return undefined;
  }

  export async function writeTarget(args: {
    root: string;
    mode: Mode | undefined;
    requestedWorkspace: string | null | undefined;
    sessionId: string;
  }): Promise<{ id: string; path: string } | null> {
    const { root, mode, requestedWorkspace, sessionId } = args;

    const explicit = Workspace.normalize(requestedWorkspace);
    if (explicit !== MAIN_FOLDER_ID) {
      return { id: explicit, path: Workspace.resolve(root, explicit) };
    }

    if (mode !== "design") return null;

    const slug = `design-${sessionId.slice(0, 8) || "untitled"}`;
    const target = await Workspace.create(root, slug);
    return { id: target.id, path: target.path };
  }

  export function reminder(args: {
    isDesignMode: boolean;
    writeTarget: { id: string; path: string } | null;
    includeSystemPrompt: boolean;
    includeDesignGuide: boolean;
    includeAttachedScope: boolean;
  }): string {
    return buildTurnReminder(args);
  }

  export function prepend(
    messages: UIMessage[],
    reminder: string,
  ): UIMessage[] {
    if (messages.length === 0 || !reminder.trim()) return messages;
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (!last || last.role !== "user") return messages;
    return [
      ...messages.slice(0, lastIdx),
      {
        ...last,
        parts: [{ type: "text", text: reminder }, ...last.parts],
      },
    ];
  }
}

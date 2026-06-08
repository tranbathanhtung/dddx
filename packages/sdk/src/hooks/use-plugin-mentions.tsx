import { useCallback, useMemo, useRef } from "react";
import { IconHighlight } from "@tabler/icons-react";

import { api } from "@/client";
import type {
  MentionItem,
  MentionTriggerConfig,
} from "@/components/agent-elements/input/lexical-input";
import { skillContext } from "@/lib/context";
import type { PluginListItem } from "@/components/plugins/types";
import { usePromptContext } from "@/components/prompt-context-provider";

function skillMentionItem(skill: PluginListItem): MentionItem {
  return {
    id: `skill:${skill.name}`,
    label: skill.title,
    description: skill.category ?? "Skill",
    icon: <IconHighlight className="size-3.5 shrink-0 opacity-70" />,
  };
}

/** Skills are attached via `@` mentions; templates/themes live in the Plugins panel. */
export function usePluginMentions(): MentionTriggerConfig {
  const { insertContextInput } = usePromptContext();
  const pluginsQuery = api.plugin.list.useQuery(undefined);

  const registryRef = useRef(new Map<string, PluginListItem>());

  const items = useMemo(() => {
    const registry = new Map<string, PluginListItem>();
    const mentions: MentionItem[] = [];

    for (const pack of pluginsQuery.data?.items ?? []) {
      for (const item of pack.items) {
        if (item.kind !== "skills") continue;
        const skill = { ...item, plugin: pack.id };
        const mention = skillMentionItem(skill);
        registry.set(mention.id, skill);
        mentions.push(mention);
      }
    }

    mentions.sort((a, b) => a.label.localeCompare(b.label));
    registryRef.current = registry;
    return mentions;
  }, [pluginsQuery.data?.items]);

  const onSelect = useCallback(
    (item: MentionItem) => {
      const skill = registryRef.current.get(item.id);
      if (!skill) return;
      insertContextInput(skillContext(skill));
    },
    [insertContextInput],
  );

  return useMemo(
    () => ({
      trigger: "/",
      items,
      onSelect,
      minLength: 0,
    }),
    [items, onSelect],
  );
}

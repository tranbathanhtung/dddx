"use client";

import { usePromptContext } from "@/components/prompt-context-provider";

import {
  skillContext,
  templateContext,
  themeContext,
} from "@/lib/context";
import { openTemplatePreview } from "@/components/dockview/panel-registry";
import { PluginMarketplaceCard } from "./plugin-marketplace-card";
import type { PluginListItem, PluginListPack } from "./types";

function itemLabel(item: PluginListItem) {
  if (item.category) return item.category.replace(/-/g, " ");
  if (item.kind === "themes") return "themes";
  if (item.kind === "templates") return "templates";
  if (item.kind === "skills") return "skill";
  return undefined;
}

function itemTone(item: PluginListItem) {
  if (item.kind === "skills" && !item.preview) {
    return "from-violet-500/20 via-background to-violet-500/10";
  }
  return undefined;
}

export function PluginItemCard({
  item,
  pack,
  showPackMeta = false,
  disabled,
}: {
  item: PluginListItem;
  pack?: PluginListPack;
  /** Show plugin pack name / author under the title (off when grouped by pack). */
  showPackMeta?: boolean;
  disabled?: boolean;
}) {
  const { insertContextInput } = usePromptContext();

  const onClick = () => {
    if (item.kind === "templates") {
      insertContextInput(templateContext(item));
      return;
    }
    if (item.kind === "themes") {
      insertContextInput(themeContext(item));
      return;
    }
    insertContextInput(skillContext(item));
  };

  return (
    <PluginMarketplaceCard
      title={item.title}
      label={itemLabel(item)}
      pluginName={showPackMeta ? pack?.name : undefined}
      author={showPackMeta ? pack?.author : undefined}
      preview={item.preview}
      tone={itemTone(item)}
      disabled={disabled}
      onClick={onClick}
      onPreview={
        (item.previewHtml ?? item.preview)?.url
          ? () => {
              const preview = item.previewHtml ?? item.preview!;
              openTemplatePreview(item.title, preview.url, preview.type);
            }
          : undefined
      }
    />
  );
}

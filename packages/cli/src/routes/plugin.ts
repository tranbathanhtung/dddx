import z from "zod";

import { router, procedure } from "@/trpc";
import { Plugin } from "@/util/plugin";
import { getProjectSlug } from "@/util/project-name";
import { err } from "./errors";

const mutation = procedure;

function resolvePreviews(
  item: Pick<Plugin.ListItem, "previews" | "kind" | "name">,
  slug: string,
) {
  if (item.kind === "skills") {
    const entry = Plugin.skillPreviewEntry(item);
    const opts = {
      slug,
      segment: "skills" as const,
      id: item.name,
    };
    const preview =
      Plugin.thumbnailPreviewFromEntry(entry, opts) ??
      Plugin.markdownPreviewFromEntry(entry, opts);
    const previewHtml =
      Plugin.markdownPreviewFromEntry(entry, opts) ?? preview;
    return { preview, previewHtml };
  }

  if (!item.previews?.length) {
    return { preview: undefined, previewHtml: undefined };
  }

  const opts = {
    slug,
    segment: item.kind as "templates" | "themes",
    id: item.name,
  };
  return {
    preview: Plugin.thumbnailPreviewFromEntry(item, opts),
    previewHtml: Plugin.panelPreviewFromEntry(item, opts),
  };
}

export const plugin = router({
  list: procedure.query(async ({ ctx }) => {
    try {
      const packs = await Plugin.list(ctx.dir);
      const slug = getProjectSlug(ctx.dir);

      return {
        items: packs
          .filter((pack) => pack.items.length > 0)
          .map((pack) => ({
            id: pack.id,
            marketplace: pack.marketplace,
            name: pack.name,
            description: pack.description,
            author: pack.author,
            homepage: pack.homepage,
            license: pack.license,
            items: pack.items.map((item) => ({
              plugin: pack.id,
              name: item.name,
              kind: item.kind,
              title: item.title,
              source: item.source,
              category: item.category,
              ...resolvePreviews(item, slug),
            })),
          })),
      };
    } catch (error) {
      throw err.internal(error);
    }
  }),

  marketplaces: router({
    list: procedure.query(async ({ ctx }) => {
      try {
        return { items: await Plugin.marketplaces(ctx.dir) };
      } catch (error) {
        throw err.internal(error);
      }
    }),

    add: mutation
      .input(
        z.object({
          source: z.string().min(1, "A GitHub link is required."),
          name: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await Plugin.add({
            source: input.source.trim(),
            name: input.name,
            dir: ctx.dir,
          });
          return { id: result.id, marketplace: result.marketplace };
        } catch (error) {
          if (error instanceof Error) throw err.badRequest(error.message);
          throw err.internal(error);
        }
      }),

    remove: mutation
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ input }) => {
        try {
          return await Plugin.remove(input.id);
        } catch (error) {
          if (error instanceof Error) throw err.badRequest(error.message);
          throw err.internal(error);
        }
      }),
  }),
});

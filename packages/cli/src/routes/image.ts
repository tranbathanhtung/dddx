import path from "path";
import z from "zod";

import { router, procedure } from "@/trpc";
import { getAuthKey } from "@/util/auth-store";
import {
  generateCanvasImage,
  getImageGenerationCatalog,
  type ImageProviderId,
} from "@/util/image-generation";
import { Filesystem } from "@/util/filesystem";
import { Workspace } from "@/util/workspace";
import { err } from "./errors";

const providerSchema = z.enum(["gateway", "openrouter"]);
const aspectSchema = z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]);
const sizeSchema = z.enum(["1K", "2K"]);

function sanitizeWorkspacePath(raw: string): string {
  const parts = raw.split(/[/\\]/).filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "..")) {
    throw err.badRequest(`Invalid path: ${raw}`);
  }
  return parts.join("/");
}

function mediaTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] ?? "image/png";
}

/** Opaque filenames — prompts/captions are not suitable as on-disk names. */
async function uniqueGeneratedImagePath(
  workspacePath: string,
  ext: string,
): Promise<string> {
  const base = "generated";
  let rel = `${base}.${ext}`;
  let n = 2;
  while (await Filesystem.exists(path.join(workspacePath, rel))) {
    rel = `${base}-${n}.${ext}`;
    n += 1;
  }
  return rel;
}

export const image = router({
  models: procedure.query(() => getImageGenerationCatalog()),

  generate: procedure
    .input(
      z.object({
        workspaceId: z.string().min(1),
        provider: providerSchema,
        modelId: z.string().min(1),
        prompt: z.string().min(1),
        aspectRatio: aspectSchema,
        size: sizeSchema,
        /** Workspace-relative path of the image to edit (img2img). */
        sourcePath: z.string().min(1).optional(),
        /** When set, overwrite this file instead of creating a new one. */
        replacePath: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = await getAuthKey(input.provider);
      if (!apiKey) {
        throw err.unauthorized();
      }

      const workspaces = await Workspace.list(ctx.dir);
      const workspace = workspaces.find((w) => w.id === input.workspaceId);
      if (!workspace || workspace.kind !== "prototype") {
        throw err.notFound(`Design workspace "${input.workspaceId}" not found`);
      }

      const sourcePath = input.sourcePath
        ? sanitizeWorkspacePath(input.sourcePath)
        : undefined;
      const replacePath = input.replacePath
        ? sanitizeWorkspacePath(input.replacePath)
        : undefined;

      if (replacePath && !sourcePath) {
        throw err.badRequest("replacePath requires sourcePath");
      }

      try {
        let source: { bytes: Buffer; mediaType: string } | undefined;
        if (sourcePath) {
          const sourceAbs = path.join(workspace.path, sourcePath);
          if (!Filesystem.contains(workspace.path, sourceAbs)) {
            throw err.badRequest("Invalid source path");
          }
          if (!(await Filesystem.exists(sourceAbs))) {
            throw err.notFound(`Image "${sourcePath}" not found`);
          }
          source = {
            bytes: await Filesystem.readBytes(sourceAbs),
            mediaType: mediaTypeFromPath(sourcePath),
          };
        }

        const generated = await generateCanvasImage({
          provider: input.provider as ImageProviderId,
          modelId: input.modelId,
          prompt: input.prompt,
          aspectRatio: input.aspectRatio,
          size: input.size,
          apiKey,
          source,
        });

        let rel: string;
        if (replacePath) {
          const replaceAbs = path.join(workspace.path, replacePath);
          if (!Filesystem.contains(workspace.path, replaceAbs)) {
            throw err.badRequest("Invalid replace path");
          }
          rel = replacePath;
          const abs = replaceAbs;
          await Filesystem.write(abs, generated.bytes);
        } else {
          rel = await uniqueGeneratedImagePath(
            workspace.path,
            generated.extension,
          );
          const abs = path.join(workspace.path, rel);
          if (!Filesystem.contains(workspace.path, abs)) {
            throw err.badRequest("Invalid generated path");
          }
          await Filesystem.write(abs, generated.bytes);
        }

        return {
          path: rel,
          mediaType: generated.mediaType,
          replaced: !!replacePath,
        };
      } catch (error) {
        if (error instanceof Error && /unknown image model/i.test(error.message)) {
          throw err.badRequest(error.message);
        }
        throw err.internal(error);
      }
    }),
});

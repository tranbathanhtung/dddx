import { router, procedure } from "@/trpc";
import path from "path";
import z from "zod";
import { TRPCError } from "@trpc/server";
import { Filesystem } from "@/util/filesystem";
import { appDir } from "@/util/global";
import { canvasFileKind, isCanvasEligiblePath } from "@/util/design-canvas-files";
import { Workspace } from "@/util/workspace";
import { listActiveStudioProjects, getPreviewTargets } from "@/studio";
import { getProjectSlug, projectSlugLabel } from "@/util/project-name";
import { err } from "./errors";

function fileRev(abs: string): number {
  const stat = Filesystem.stat(abs);
  const mtime = stat?.mtimeMs;
  if (typeof mtime === "bigint") return Number(mtime);
  if (typeof mtime === "number") return mtime;
  if (stat?.mtime instanceof Date) return stat.mtime.getTime();
  return Date.now();
}

function sanitizeUploadPath(raw: string): string {
  const parts = raw.split(/[/\\]/).filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "..")) {
    throw err.badRequest(`Invalid upload path: ${raw}`);
  }
  return parts.join("/");
}

export const project = router({
  current: procedure.query(async ({ ctx }) => {
    try {
      const directory = path.resolve(ctx.dir);
      const slug = getProjectSlug(directory);

      return {
        directory,
        project: {
          id: slug,
          name: projectSlugLabel(slug),
        },
      };
    } catch (error) {
      throw err.internal(error);
    }
  }),

  active: router({
    list: procedure.query(async ({ ctx }) => {
      try {
        const current = path.resolve(ctx.dir);
        const projects = await listActiveStudioProjects();
        return {
          projects: projects.map((project) => ({
            ...project,
            isCurrent: path.resolve(project.directory) === current,
          })),
        };
      } catch (error) {
        throw err.internal(error);
      }
    }),
  }),

  preview: router({
    targets: procedure.query(async ({ ctx }) => {
      try {
        return getPreviewTargets(ctx.dir);
      } catch (error) {
        throw err.internal(error);
      }
    }),
  }),

  designs: router({
    list: procedure.query(async ({ ctx }) => {
      try {
        const workspaces = await Workspace.list(ctx.dir);
        const designs = workspaces.filter((w) => w.kind === "prototype");
        return { designs };
      } catch (error) {
        throw err.internal(error);
      }
    }),
    get: procedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const workspaces = await Workspace.list(ctx.dir);
        const workspace = workspaces.find((w) => w.id === input.id);
        if (!workspace) {
          throw err.notFound(`Workspace "${input.id}" not found`);
        }
        try {
          const files: {
            path: string;
            kind: "html" | "image" | "video";
            content?: string;
            rev: number;
          }[] = [];
          let workspaceRev = 0;

          for await (const rel of Filesystem.walkFiles(workspace.path)) {
            const normalized = rel.split(path.sep).join("/");
            if (
              workspace.kind === "main" &&
              normalized.startsWith(`${appDir}/`)
            ) {
              continue;
            }
            const kind = canvasFileKind(normalized);
            if (
              !kind ||
              !isCanvasEligiblePath(normalized, kind, workspace.kind)
            ) {
              continue;
            }
            const abs = path.join(workspace.path, rel);
            if (!Filesystem.contains(workspace.path, abs)) continue;
            const rev = fileRev(abs);
            workspaceRev = Math.max(workspaceRev, rev);
            if (kind === "html") {
              const content = await Filesystem.readText(abs);
              files.push({ path: normalized, kind, content, rev });
            } else {
              files.push({ path: normalized, kind, rev });
            }
          }

          for await (const rel of Filesystem.walkFiles(workspace.path, {
            extensions: [".css", ".js"],
          })) {
            const normalized = rel.split(path.sep).join("/");
            const abs = path.join(workspace.path, rel);
            if (!Filesystem.contains(workspace.path, abs)) continue;
            workspaceRev = Math.max(workspaceRev, fileRev(abs));
          }

          files.sort((a, b) => a.path.localeCompare(b.path));

          return {
            id: workspace.id,
            name: workspace.name,
            kind: workspace.kind,
            rev: workspaceRev,
            files,
          };
        } catch (error) {
          throw err.internal(error);
        }
      }),
    upload: procedure
      .input(
        z.object({
          id: z.string().min(1),
          files: z
            .array(
              z.object({
                path: z.string().min(1),
                contentBase64: z.string().min(1),
              }),
            )
            .min(1)
            .max(50),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const workspaces = await Workspace.list(ctx.dir);
        const workspace = workspaces.find((w) => w.id === input.id);
        if (!workspace || workspace.kind !== "prototype") {
          throw err.notFound(`Design workspace "${input.id}" not found`);
        }

        try {
          const written: string[] = [];
          for (const file of input.files) {
            const rel = sanitizeUploadPath(file.path);
            const abs = path.join(workspace.path, rel);
            if (!Filesystem.contains(workspace.path, abs)) {
              throw err.badRequest(`Invalid upload path: ${file.path}`);
            }
            const bytes = Buffer.from(file.contentBase64, "base64");
            await Filesystem.write(abs, bytes);
            written.push(rel);
          }
          return { written };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw err.internal(error);
        }
      }),
  }),

  workspaces: router({
    list: procedure.query(async ({ ctx }) => {
      try {
        const workspaces = await Workspace.list(ctx.dir);
        return { workspaces };
      } catch (error) {
        throw err.internal(error);
      }
    }),
    create: procedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const workspace = await Workspace.create(ctx.dir, input.name);
          return { workspace };
        } catch (error) {
          throw err.internal(error);
        }
      }),
  }),
});

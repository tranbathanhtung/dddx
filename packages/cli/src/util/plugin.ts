import path from "path";
import { fileURLToPath } from "node:url";
import { readdir, rm } from "fs/promises";

import { Filesystem } from "./filesystem";
import { execText } from "./shell";
import { Global } from "./global";
import { titleFromId } from "./title";
import { pullOfficial } from "./plugin-r2";
import { PREVIEW_FILENAME, PREVIEW_REL } from "./preview-assets";

const SYSTEM = ".system";
const MANIFEST_DIR = ".dddx-plugin";
const MANIFEST_FILE = "plugin.json";
const COLLECTION_FILE = "marketplace.json";
const REGISTRY_FILE = "registry.json";
const METADATA = "metadata.json";
const KINDS = ["themes", "templates", "skills"] as const;

/** Reserved id for the bundled official marketplace namespace. */
const OFFICIAL = "official";

export type PluginKind = "templates" | "skills" | "themes";

export type PluginItem = {
  source: string;
  name: string;
  title?: string;
  version?: string;
  description?: string;
  license?: string;
  author?: ItemMetadata["author"];
  homepage?: string;
  tags?: string[];
  category?: string;
  previews?: string[];
  /** Relative prompt file path. Templates only. */
  prompt?: string;
};

export function itemKind(item: Pick<PluginItem, "source">): PluginKind {
  const rel = item.source.replace(/^\.\//, "");
  if (rel.startsWith("templates/")) return "templates";
  if (rel.startsWith("skills/")) return "skills";
  return "themes";
}

export type PluginManifest = {
  name: string;
  description?: string;
  author?: ItemMetadata["author"];
  homepage?: string;
  license?: string;
  items: PluginItem[];
};

export type MarketplacePlugin = {
  name: string;
  source: string;
  plugin: PluginManifest;
};

export type Marketplace = {
  version: number;
  name: string;
  description?: string;
  plugins: MarketplacePlugin[];
};

/** A single installed marketplace namespace, tracked in registry.json. */
export type RegistryEntry = {
  /** Folder name under ~/.dddx/plugins (the marketplace namespace). */
  id: string;
  /** "bundled" for official, or the GitHub URL it was added from. */
  source: string;
  ref?: string;
  subpath?: string;
  version?: number;
  name?: string;
  description?: string;
};

/** Top-level index of every installed marketplace. */
export type Registry = {
  version: number;
  marketplaces: RegistryEntry[];
};

/** Marketplace summary surfaced to the UI. */
export type MarketplaceSummary = {
  id: string;
  name: string;
  description?: string;
  source: string;
  official: boolean;
  version?: number;
  pluginCount: number;
};

/** Normalized catalog entry derived from a plugin manifest item. */
export type Entry = {
  name: string;
  source: string;
  kind: PluginKind;
  title?: string;
  description?: string;
  license?: string;
  author?: ItemMetadata["author"];
  homepage?: string;
  tags?: string[];
  category?: string;
  preview?: "html" | "image" | "markdown" | "video";
  /** Relative prompt file. Templates and skills only. */
  prompt?: string;
  previews?: string[];
};

export type ItemMetadata = {
  name: string;
  title?: string;
  version?: string;
  description?: string;
  license?: string;
  author?: { name: string; url?: string };
  homepage?: string;
  tags?: string[];
  categories?: string[];
};

export function isRemotePreview(ref: string) {
  return /^https?:\/\//i.test(ref.trim());
}

export function entryKind(entry: Entry): PluginKind {
  if (entry.kind) return entry.kind;
  const rel = entry.source.replace(/^\.\//, "");
  if (rel.startsWith("templates/")) return "templates";
  if (rel.startsWith("skills/")) return "skills";
  return "themes";
}

export function entryFor(
  entries: Entry[] | null | undefined,
  id: string,
  kind?: PluginKind,
): Entry | null {
  if (!entries?.length) return null;
  return (
    entries.find(
      (entry) => entry.name === id && (!kind || entryKind(entry) === kind),
    ) ?? null
  );
}

type Pack = {
  id: string;
  marketplace: string;
  name: string;
  description?: string;
  path: string;
  absolute: string;
  core: boolean;
  version: number;
  source?: string;
  author?: ItemMetadata["author"];
  homepage?: string;
  license?: string;
};

type Git = {
  owner: string;
  repo: string;
  ref: string;
  subpath: string;
  url: string;
};

export namespace Plugin {
  /** Installed plugin pack with manifest items (gallery + mentions). */
  export type ListPack = {
    id: string;
    marketplace: string;
    name: string;
    description?: string;
    author?: ItemMetadata["author"];
    homepage?: string;
    license?: string;
    items: ListItem[];
  };

  /** Single manifest item with an on-disk source path. */
  export type ListItem = {
    name: string;
    kind: PluginKind;
    title: string;
    /** Absolute path to the item folder on the user's machine. */
    source: string;
    category?: string;
    preview?: "html" | "image" | "markdown" | "video";
    previews?: string[];
  };

  function manifestPath(dir: string) {
    return path.join(dir, MANIFEST_DIR, MANIFEST_FILE);
  }

  function marketplaceFile(root: string) {
    return path.join(root, COLLECTION_FILE);
  }

  async function readMarketplace(file: string) {
    return Filesystem.readJsonIfValid<Marketplace>(file);
  }

  async function writeMarketplace(file: string, data: Marketplace) {
    await Filesystem.writeJson(file, data);
  }

  function itemName(item: PluginItem) {
    if (item.name) return item.name;
    const rel = item.source.replace(/^\.\//, "");
    return path.basename(rel);
  }

  function normalizePluginItem(
    item: PluginItem & { kind?: PluginKind; metadata?: ItemMetadata },
  ): PluginItem {
    const rel = item.source.replace(/^\.\//, "");
    const meta = item.metadata;

    return {
      source: item.source,
      name: item.name ?? meta?.name ?? path.basename(rel),
      title: item.title ?? meta?.title,
      version: item.version ?? meta?.version,
      description: item.description ?? meta?.description,
      license: item.license ?? meta?.license,
      author: item.author ?? meta?.author,
      homepage: item.homepage ?? meta?.homepage,
      tags: item.tags ?? meta?.tags,
      category: item.category ?? meta?.categories?.[0],
      previews: item.previews,
      prompt: item.prompt,
    };
  }

  export type PreviewMediaKind = "html" | "image" | "markdown" | "video";

  export type PreviewRef = { type: PreviewMediaKind; url: string };

  export type PreviewSegment = "templates" | "themes" | "skills";

  const THUMBNAIL_PREVIEW_ORDER: PreviewMediaKind[] = [
    "image",
    "html",
    "video",
    "markdown",
  ];

  const PANEL_PREVIEW_ORDER: PreviewMediaKind[] = [
    "video",
    "html",
    "image",
    "markdown",
  ];

  export function previewForRef(
    ref: string,
    opts: {
      slug: string;
      segment: PreviewSegment;
      id: string;
      variant?: "thumbnail" | "html" | "panel";
    },
  ): PreviewRef | undefined {
    const type = previewKind(ref);
    if (!type) return undefined;
    // Always serve previews through the CLI so gallery assets stay same-origin.
    const base = opts.slug
      ? `/p/${encodeURIComponent(opts.slug)}/${opts.segment}/${encodeURIComponent(opts.id)}/preview`
      : `/${opts.segment}/${encodeURIComponent(opts.id)}/preview`;
    let url = base;
    if (opts.variant === "html" && type === "html") {
      url = `${base}/html`;
    } else if (opts.variant === "panel" && type !== "html") {
      url = `${base}/panel`;
    }
    return { type, url };
  }

  function previewFromEntryByOrder(
    entry: Pick<Entry, "previews">,
    opts: { slug: string; segment: PreviewSegment; id: string },
    order: readonly PreviewMediaKind[],
    variant?: "thumbnail" | "html" | "panel",
  ): PreviewRef | undefined {
    for (const kind of order) {
      for (const ref of entry.previews ?? []) {
        if (previewKind(ref) !== kind) continue;
        const refVariant =
          kind === "html"
            ? "html"
            : variant === "panel"
              ? "panel"
              : undefined;
        const preview = previewForRef(ref, { ...opts, variant: refVariant });
        if (preview) return preview;
      }
    }
    return undefined;
  }

  /** Gallery card thumbnail — image, then html, video, markdown. */
  export function thumbnailPreviewFromEntry(
    entry: Pick<Entry, "previews">,
    opts: { slug: string; segment: PreviewSegment; id: string },
  ): PreviewRef | undefined {
    return previewFromEntryByOrder(entry, opts, THUMBNAIL_PREVIEW_ORDER);
  }

  /** Dock panel preview — video, then html, image, markdown. */
  export function panelPreviewFromEntry(
    entry: Pick<Entry, "previews">,
    opts: { slug: string; segment: PreviewSegment; id: string },
  ): PreviewRef | undefined {
    return previewFromEntryByOrder(entry, opts, PANEL_PREVIEW_ORDER, "panel");
  }

  /** Full interactive preview — first HTML preview ref. */
  export function htmlPreviewFromEntry(
    entry: Pick<Entry, "previews">,
    opts: { slug: string; segment: PreviewSegment; id: string },
  ): PreviewRef | undefined {
    for (const ref of entry.previews ?? []) {
      if (previewKind(ref) === "html") {
        return previewForRef(ref, { ...opts, variant: "html" });
      }
    }
    return undefined;
  }

  /** Full preview for markdown skills — first markdown preview ref. */
  export function markdownPreviewFromEntry(
    entry: Pick<Entry, "previews">,
    opts: { slug: string; segment: PreviewSegment; id: string },
  ): PreviewRef | undefined {
    for (const ref of entry.previews ?? []) {
      if (previewKind(ref) === "markdown") {
        return previewForRef(ref, opts);
      }
    }
    return undefined;
  }

  export function skillPreviewEntry(
    item: Pick<Entry, "previews">,
  ): Pick<Entry, "previews"> {
    return {
      previews: item.previews?.length ? item.previews : ["./SKILL.md"],
    };
  }

  /** @deprecated Use {@link thumbnailPreviewFromEntry}. */
  export function previewFromEntry(
    entry: Pick<Entry, "previews">,
    opts: { slug: string; segment: PreviewSegment; id: string },
  ) {
    return thumbnailPreviewFromEntry(entry, opts);
  }

  function previewKind(file: string): PreviewMediaKind | undefined {
    if (file.endsWith(".html")) return "html";
    if (/\.(md|markdown)$/i.test(file)) return "markdown";
    if (/\.(png|jpg|jpeg|gif|webp)$/i.test(file)) return "image";
    if (/\.(mp4|webm|mov|m4v|ogv|ogg)$/i.test(file)) return "video";
    return undefined;
  }

  async function filesInDir(dir: string) {
    if (!(await Filesystem.isDir(dir))) return [] as string[];
    return (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  }

  async function firstHtmlInDir(dir: string) {
    const names = await filesInDir(dir);
    for (const preferred of ["template.html", "index.html"]) {
      if (names.includes(preferred)) return path.join(dir, preferred);
    }
    const html = names.filter((name) => name.endsWith(".html")).sort();
    return html[0] ? path.join(dir, html[0]) : null;
  }

  function mergePreviewRefs(htmlRef: string) {
    return [...new Set([PREVIEW_REL, htmlRef])];
  }

  async function resolveHtmlPreviewRef(itemDir: string, item: PluginItem) {
    for (const ref of item.previews ?? []) {
      if (previewKind(ref) !== "html") continue;
      if (isRemotePreview(ref)) return ref;
      const file = itemPath(itemDir, ref);
      if (await Filesystem.exists(file)) return ref;
    }

    if (itemKind(item) !== "templates") return null;
    const html = await firstHtmlInDir(itemDir);
    return html ? `./${path.basename(html)}` : null;
  }

  async function previewRefsForTemplate(
    itemDir: string,
    htmlAbs: string | null,
  ) {
    if (!htmlAbs) return undefined;
    const relHtml = `./${path.basename(htmlAbs)}`;
    const webpAbs = path.join(itemDir, PREVIEW_FILENAME);
    if (await Filesystem.exists(webpAbs)) {
      return mergePreviewRefs(relHtml);
    }
    return [relHtml];
  }

  async function normalizePreviewRefs(packDir: string, item: PluginItem) {
    if (itemKind(item) === "skills") return;
    const itemDir = path.join(packDir, item.source.replace(/^\.\//, ""));
    if (!(await Filesystem.isDir(itemDir))) return;

    const webpAbs = path.join(itemDir, PREVIEW_FILENAME);
    if (!(await Filesystem.exists(webpAbs))) return;

    const htmlRef = await resolveHtmlPreviewRef(itemDir, item);
    item.previews = htmlRef ? mergePreviewRefs(htmlRef) : [PREVIEW_REL];
  }

  async function capturePreviewsForItem(
    packDir: string,
    item: PluginItem,
    opts: { force?: boolean },
  ) {
    if (itemKind(item) === "skills") return;

    const itemDir = path.join(packDir, item.source.replace(/^\.\//, ""));
    if (!(await Filesystem.isDir(itemDir))) return;

    const htmlRef = await resolveHtmlPreviewRef(itemDir, item);
    if (!htmlRef) return;

    const outputAbs = path.join(itemDir, PREVIEW_FILENAME);
    const htmlTarget = isRemotePreview(htmlRef)
      ? htmlRef.trim()
      : itemPath(itemDir, htmlRef);

    const { captureHtmlPreview } = await import("./capture-preview");
    await captureHtmlPreview(htmlTarget, outputAbs, { force: opts.force });
    item.previews = mergePreviewRefs(htmlRef);
  }

  async function templateFocusFile(dir: string, entry: Entry) {
    for (const rel of entry.previews ?? []) {
      if (previewKind(rel) !== "html") continue;
      const file = itemPath(dir, rel);
      if (await Filesystem.exists(file)) return file;
    }
    return firstHtmlInDir(dir);
  }

  function itemPath(itemDir: string, rel: string) {
    return path.join(itemDir, rel.replace(/^\.\//, ""));
  }

  export async function readMetadata(dir: string) {
    const file = path.join(dir, METADATA);
    return Filesystem.readJsonIfValid<ItemMetadata>(file);
  }

  async function readManifest(dir: string) {
    const file = manifestPath(dir);
    return Filesystem.readJsonIfValid<PluginManifest>(file);
  }

  async function writeManifest(dir: string, data: PluginManifest) {
    await Filesystem.ensureDir(path.join(dir, MANIFEST_DIR));
    await Filesystem.writeJson(manifestPath(dir), data);
  }

  async function buildIndexItems(dir: string): Promise<PluginItem[]> {
    const items: PluginItem[] = [];

    for (const kind of KINDS) {
      const kindDir = path.join(dir, kind);
      if (!(await Filesystem.isDir(kindDir))) continue;

      for (const name of await dirs(kindDir)) {
        const itemDir = path.join(kindDir, name);
        const meta = await readMetadata(itemDir);
        const htmlFocus =
          kind === "templates" ? await firstHtmlInDir(itemDir) : null;

        items.push({
          source: `./${kind}/${name}`,
          name,
          title: meta?.title,
          description: meta?.description,
          license: meta?.license,
          author: meta?.author,
          homepage: meta?.homepage,
          tags: meta?.tags,
          ...(kind === "templates"
            ? {
                category: meta?.categories?.[0],
                previews: await previewRefsForTemplate(itemDir, htmlFocus),
              }
            : kind === "skills" &&
                (await Filesystem.exists(path.join(itemDir, "SKILL.md")))
              ? { previews: ["./SKILL.md"] }
              : {}),
        });
      }
    }

    return items.sort((a, b) => itemName(a).localeCompare(itemName(b)));
  }

  function itemToEntry(packDir: string, raw: PluginItem): Entry {
    const item = normalizePluginItem(raw);
    const kind = itemKind(item);

    let preview: Entry["preview"];
    for (const kind of THUMBNAIL_PREVIEW_ORDER) {
      for (const previewRel of item.previews ?? []) {
        if (previewKind(previewRel) === kind) {
          preview = kind;
          break;
        }
      }
      if (preview) break;
    }

    return {
      name: itemName(item),
      source: item.source,
      kind,
      title: item.title,
      description: item.description,
      license: item.license,
      author: item.author,
      homepage: item.homepage,
      tags: item.tags,
      category: item.category,
      preview,
      prompt: item.prompt,
      previews: item.previews,
    };
  }

  function entriesFromManifest(
    packDir: string,
    manifest: PluginManifest,
  ): Entry[] {
    return manifest.items
      .filter((item) => item.source && (item.name || item.source))
      .map((item) => itemToEntry(packDir, item));
  }

  async function entriesFor(packDir: string): Promise<Entry[]> {
    return buildIndexEntries(packDir);
  }

  async function buildIndexEntries(dir: string): Promise<Entry[]> {
    const items = await buildIndexItems(dir);
    return items.map((item) => itemToEntry(dir, item));
  }

  type ItemMatch = { entry: Entry; dir: string };

  function entryToListItem(pack: Pack, entry: Entry): ListItem {
    const rel = entry.source.replace(/^\.\//, "");
    return {
      name: entry.name,
      kind: entryKind(entry),
      title: entry.title ?? titleFromId(entry.name),
      source: path.join(pack.absolute, rel),
      category: entry.category,
      preview: entry.preview,
      previews: entry.previews,
    };
  }

  function previewBaseDir(itemDir: string, entry: Entry) {
    for (const previewRel of entry.previews ?? []) {
      if (previewKind(previewRel) !== "html") continue;
      if (isRemotePreview(previewRel)) return itemDir;
      return path.dirname(itemPath(itemDir, previewRel));
    }

    const previewRel = entry.previews?.[0];
    if (!previewRel || isRemotePreview(previewRel)) return itemDir;
    return path.dirname(itemPath(itemDir, previewRel));
  }

  async function findItem(
    base: string,
    name: string,
    kind?: PluginKind,
  ): Promise<ItemMatch | null> {
    await ensure(base);

    for (const { item, entries } of await pairs(base)) {
      const entry = entryFor(entries, name, kind);
      if (!entry) continue;

      const rel = entry.source.replace(/^\.\//, "");
      const dir = path.join(item.absolute, rel);
      if (await Filesystem.isDir(dir)) return { entry, dir };
    }

    return null;
  }

  /** Resolve a preview asset path or remote URL for an installed item. */
  export async function preview(
    base: string,
    kind: PluginKind,
    name: string,
    mode: "thumbnail" | "html" | "panel" = "thumbnail",
  ) {
    const match = await findItem(base, name, kind);
    if (!match) return null;

    const refs =
      kind === "skills"
        ? skillPreviewEntry(match.entry).previews ?? []
        : (match.entry.previews ?? []);
    if (!refs.length) return null;

    const resolveRef = async (ref: string) => {
      if (isRemotePreview(ref)) return ref.trim();
      const previewPath = itemPath(match.dir, ref);
      if (await Filesystem.exists(previewPath)) return previewPath;
      return null;
    };

    const order =
      mode === "panel"
        ? PANEL_PREVIEW_ORDER
        : mode === "html"
          ? (["html"] as const)
          : THUMBNAIL_PREVIEW_ORDER;

    for (const mediaKind of order) {
      for (const ref of refs) {
        if (previewKind(ref) !== mediaKind) continue;
        const resolved = await resolveRef(ref);
        if (resolved) return resolved;
      }
    }

    return null;
  }

  function safeAssetName(name: string) {
    const base = path.basename(name);
    if (!base || base !== name || base === "." || base === "..") return null;
    return base;
  }

  async function resolveAsset(baseDir: string, name: string) {
    const candidates = [name, name.replace(/-/g, "_"), name.replace(/_/g, "-")];

    for (const candidate of new Set(candidates)) {
      const asset = path.join(baseDir, candidate);
      if (await Filesystem.exists(asset)) return asset;
    }

    return null;
  }

  /** Resolve a relative asset next to a template preview HTML file. */
  export async function previewAsset(
    base: string,
    name: string,
    filename: string,
  ) {
    const assetName = safeAssetName(filename);
    if (!assetName) return null;

    const match = await findItem(base, name, "templates");
    if (!match?.entry.previews?.length) return null;

    const baseDir = previewBaseDir(match.dir, match.entry);
    return resolveAsset(baseDir, assetName);
  }

  const inflight = new Map<string, Promise<ListPack[]>>();

  export function root() {
    return path.join(Global.Path.app, "plugins");
  }

  /** Absolute path of a marketplace namespace under the plugins root. */
  function marketplaceDir(id: string) {
    return path.join(root(), id);
  }

  function registryFile() {
    return path.join(root(), REGISTRY_FILE);
  }

  async function readRegistry(): Promise<Registry | null> {
    return Filesystem.readJsonIfValid<Registry>(registryFile());
  }

  async function writeRegistry(registry: Registry) {
    await Filesystem.writeJson(registryFile(), registry);
  }

  async function upsertRegistry(entry: RegistryEntry) {
    const registry = (await readRegistry()) ?? { version: 1, marketplaces: [] };
    const idx = registry.marketplaces.findIndex((m) => m.id === entry.id);
    if (idx >= 0) {
      registry.marketplaces[idx] = { ...registry.marketplaces[idx], ...entry };
    } else {
      registry.marketplaces.push(entry);
    }
    await writeRegistry(registry);
  }

  function sanitizeMarketplaceId(raw: string) {
    return raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 64);
  }

  async function project(start = process.cwd()) {
    return path.resolve(start);
  }

  async function bundled() {
    const dir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../plugins-official",
    );
    if (!(await Filesystem.isDir(dir))) return null;
    return dir;
  }

  async function mono(start: string) {
    for await (const match of Filesystem.up({
      targets: [path.join("packages", "plugins-official")],
      start,
    })) {
      if (await Filesystem.isDir(match)) return match;
    }
    return null;
  }

  async function origin(base: string) {
    return (await mono(base)) ?? (await bundled());
  }

  async function valid(dir: string) {
    if (await Filesystem.exists(manifestPath(dir))) return true;

    const checks = await Promise.all(
      KINDS.map((kind) => Filesystem.isDir(path.join(dir, kind))),
    );
    return checks.some(Boolean);
  }

  async function isCollectionRoot(dir: string) {
    const marketplace = await readMarketplace(marketplaceFile(dir));
    if (marketplace?.plugins?.length) return true;

    let count = 0;
    for (const name of await dirs(dir)) {
      if (await valid(path.join(dir, name))) count += 1;
    }
    return count > 1;
  }

  async function dirs(dir: string) {
    if (!(await Filesystem.isDir(dir))) return [] as string[];
    return (await readdir(dir, { withFileTypes: true }))
      .filter(
        (e) =>
          e.isDirectory() && (!e.name.startsWith(".") || e.name === SYSTEM),
      )
      .map((e) => e.name);
  }

  export async function scan(dir: string) {
    return buildIndexEntries(dir);
  }

  async function copy(from: string, to: string) {
    await Filesystem.ensureDir(to);

    await Promise.all(
      (await readdir(from, { withFileTypes: true })).map(async (node) => {
        const src = path.join(from, node.name);
        const dst = path.join(to, node.name);
        if (node.isDirectory()) return copy(src, dst);
        if (node.isFile())
          await Filesystem.write(dst, await Filesystem.readText(src));
      }),
    );
  }

  /** Sync the official marketplace from R2 into `official/`. */
  async function syncOfficial() {
    const officialDir = marketplaceDir(OFFICIAL);
    await Filesystem.ensureDir(officialDir);

    try {
      const result = await pullOfficial(officialDir);
      const marketplace = await readMarketplace(marketplaceFile(officialDir));
      await upsertRegistry({
        id: OFFICIAL,
        source: "r2",
        version: result.version,
        name: marketplace?.name,
        description: marketplace?.description,
      });
      return result;
    } catch (error) {
      const local = await readMarketplace(marketplaceFile(officialDir));
      if (local?.plugins?.length) {
        await upsertRegistry({
          id: OFFICIAL,
          source: "r2",
          version: local.version,
          name: local.name,
          description: local.description,
        });
        return {
          synced: false,
          version: local.version ?? -1,
          from: "r2" as const,
        };
      }
      throw error;
    }
  }

  async function marketplaceInstalled(
    rootDir: string,
    marketplace: Marketplace,
  ) {
    for (const plugin of marketplace.plugins) {
      const rel = plugin.source.replace(/^\.\//, "");
      const pluginDir = path.join(rootDir, rel);
      if (!(await Filesystem.isDir(pluginDir))) return false;
    }
    return true;
  }

  /** Marketplace namespaces present on disk (registry first, then scan). */
  async function marketplaceIds(): Promise<string[]> {
    const registry = await readRegistry();
    const ids = new Set<string>(registry?.marketplaces.map((m) => m.id) ?? []);

    for (const name of await dirs(root())) {
      const dir = marketplaceDir(name);
      const hasMarketplace = await Filesystem.exists(marketplaceFile(dir));
      if (
        hasMarketplace ||
        (await isCollectionRoot(dir)) ||
        (await valid(dir))
      ) {
        ids.add(name);
      }
    }

    const ordered = [...ids];
    ordered.sort((a, b) => {
      if (a === OFFICIAL) return -1;
      if (b === OFFICIAL) return 1;
      return a.localeCompare(b);
    });
    return ordered;
  }

  export async function ensure(base: string) {
    await Filesystem.ensureDir(root());
    const official = await syncOfficial();
    return { root: root(), official };
  }

  /** Compose a globally-unique pack id namespaced by its marketplace. */
  function packId(id: string, name: string) {
    return `${id}/${name}`;
  }

  function packFromMarketplace(
    marketplace: string,
    home: string,
    plugin: MarketplacePlugin,
    version: number,
  ): Pack {
    const rel = plugin.source.replace(/^\.\//, "");
    const name = path.basename(rel);
    const absolute = path.join(home, rel);
    const manifest = plugin.plugin;

    return {
      id: packId(marketplace, name),
      marketplace,
      name: manifest.name,
      description: manifest.description,
      path: rel,
      absolute,
      core: marketplace === OFFICIAL,
      version,
      author: manifest.author,
      homepage: manifest.homepage,
      license: manifest.license,
    };
  }

  async function packFromDir(
    marketplace: string,
    home: string,
    name: string,
    absolute: string,
  ): Promise<Pack | null> {
    if (!(await Filesystem.isDir(absolute))) return null;
    if (!(await valid(absolute))) return null;

    const manifest = await readManifest(absolute);

    return {
      id: packId(marketplace, name),
      marketplace,
      name: manifest?.name ?? titleFromId(name),
      description: manifest?.description,
      path: name,
      absolute,
      core: marketplace === OFFICIAL,
      version: 1,
      author: manifest?.author,
      homepage: manifest?.homepage,
      license: manifest?.license,
    };
  }

  /** All (pack, entries) pairs for a single marketplace namespace. */
  async function pairsForMarketplace(
    marketplace: string,
  ): Promise<{ item: Pack; entries: Entry[] }[]> {
    const home = marketplaceDir(marketplace);
    const data = await readMarketplace(marketplaceFile(home));

    if (data?.plugins?.length) {
      return data.plugins.map((plugin) => {
        const item = packFromMarketplace(
          marketplace,
          home,
          plugin,
          data.version,
        );
        return {
          item,
          entries: entriesFromManifest(item.absolute, plugin.plugin),
        };
      });
    }

    const result: { item: Pack; entries: Entry[] }[] = [];
    for (const name of await dirs(home)) {
      const pack = await packFromDir(
        marketplace,
        home,
        name,
        path.join(home, name),
      );
      if (pack) {
        result.push({ item: pack, entries: await entriesFor(pack.absolute) });
      }
    }
    return result;
  }

  function sortPacks<T extends { item: Pack }>(rows: T[]): T[] {
    return rows.sort((a, b) => {
      if (a.item.core && !b.item.core) return -1;
      if (b.item.core && !a.item.core) return 1;
      return a.item.name.localeCompare(b.item.name);
    });
  }

  async function pairs(base: string) {
    await ensure(base);
    const ids = await marketplaceIds();

    const groups = await Promise.all(ids.map((id) => pairsForMarketplace(id)));
    return sortPacks(groups.flat());
  }

  /** Installed marketplace summaries for the plugins panel. */
  export async function marketplaces(
    base: string,
  ): Promise<MarketplaceSummary[]> {
    await ensure(base);
    const registry = await readRegistry();
    const ids = await marketplaceIds();

    return Promise.all(
      ids.map(async (id) => {
        const entry = registry?.marketplaces.find((m) => m.id === id);
        const marketplace = await readMarketplace(
          marketplaceFile(marketplaceDir(id)),
        );
        return {
          id,
          name: marketplace?.name ?? entry?.name ?? titleFromId(id),
          description: marketplace?.description ?? entry?.description,
          source: entry?.source ?? (id === OFFICIAL ? "r2" : "local"),
          official: id === OFFICIAL,
          version: marketplace?.version ?? entry?.version,
          pluginCount: marketplace?.plugins?.length ?? 0,
        };
      }),
    );
  }

  export function parse(input: string): Git {
    const url = new URL(input.replace(/\.git$/, ""));
    if (url.hostname !== "github.com") {
      throw new Error("Only GitHub URLs are supported.");
    }

    const [owner, repo, ...rest] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repo) {
      throw new Error(
        "Invalid GitHub URL. Expected https://github.com/owner/repo",
      );
    }

    if (rest[0] === "tree" || rest[0] === "blob") {
      return {
        owner,
        repo,
        ref: rest[1] ?? "main",
        subpath: rest.slice(2).join("/"),
        url: `https://github.com/${owner}/${repo}`,
      };
    }

    return {
      owner,
      repo,
      ref: "main",
      subpath: "",
      url: `https://github.com/${owner}/${repo}`,
    };
  }

  /**
   * Add a marketplace from a GitHub link. The repo (or `tree`/`blob` subpath)
   * may be either a collection (has marketplace.json) or a single plugin, which
   * is wrapped into a one-plugin marketplace. Everything lands in its own
   * `~/.dddx/plugins/<id>` namespace and is recorded in registry.json.
   */
  export async function add(opts: {
    source: string;
    dir?: string;
    name?: string;
  }) {
    const base = path.resolve(opts.dir ?? (await project()));
    const git = parse(opts.source);
    const rawId =
      opts.name?.trim() ||
      (git.subpath ? path.basename(git.subpath) : `${git.owner}-${git.repo}`);
    const id = sanitizeMarketplaceId(rawId);

    if (!id || id === OFFICIAL) {
      throw new Error(
        `Invalid marketplace name "${rawId}". Pass --name with a valid identifier.`,
      );
    }

    await ensure(base);

    const home = root();
    const target = marketplaceDir(id);
    if (await Filesystem.exists(target)) {
      throw new Error(
        `Marketplace "${id}" already exists. Remove it first or pass a different --name.`,
      );
    }

    const tmp = path.join(home, `.tmp-${id}-${Date.now().toString(36)}`);

    try {
      execText(
        "git",
        ["clone", "--depth", "1", "--branch", git.ref, `${git.url}.git`, tmp],
        { quiet: true },
      );

      const src = git.subpath ? path.join(tmp, git.subpath) : tmp;
      if (!(await Filesystem.isDir(src))) {
        throw new Error(
          git.subpath
            ? `Path "${git.subpath}" was not found in ${git.url}.`
            : `Repository ${git.url} did not clone successfully.`,
        );
      }

      const srcMarketplace = await readMarketplace(marketplaceFile(src));
      let version: number | undefined;

      if (srcMarketplace?.plugins?.length) {
        // A full collection: copy it wholesale into the namespace.
        await copy(src, target);
        version = srcMarketplace.version;
      } else if (await valid(src)) {
        // A single plugin: wrap it into a one-plugin marketplace.
        const pluginName = sanitizeMarketplaceId(
          git.subpath ? path.basename(git.subpath) : git.repo,
        );
        const pluginDir = path.join(target, pluginName);
        await copy(src, pluginDir);
        await indexPlugin({
          dir: pluginDir,
          name: titleFromId(pluginName),
          source: opts.source,
        });
        const manifest = await readManifest(pluginDir);
        await writeMarketplace(marketplaceFile(target), {
          version: 1,
          name: titleFromId(id),
          plugins: [
            {
              name: manifest?.name ?? pluginName,
              source: `./${pluginName}`,
              plugin: manifest ?? { name: pluginName, items: [] },
            },
          ],
        });
        version = 1;
      } else {
        throw new Error(
          "Source is neither a marketplace (marketplace.json) nor a plugin (.dddx-plugin/plugin.json or themes/, templates/, skills/).",
        );
      }

      await upsertRegistry({
        id,
        source: opts.source,
        ref: git.ref,
        subpath: git.subpath || undefined,
        version,
      });
      invalidate();

      const summary = (await marketplaces(base)).find((m) => m.id === id);

      return {
        dir: base,
        pluginsRoot: home,
        id,
        marketplace: summary,
      };
    } catch (error) {
      await rm(target, { recursive: true, force: true });
      throw error;
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }

  export async function indexPlugin(opts: {
    dir?: string;
    name?: string;
    description?: string;
    source?: string;
    author?: ItemMetadata["author"];
    homepage?: string;
    license?: string;
    capturePreviews?: boolean;
    forcePreviews?: boolean;
  }) {
    const dir = path.resolve(opts.dir ?? process.cwd());

    if (!(await valid(dir))) {
      throw new Error(
        "Current folder does not look like a plugin. Add .dddx-plugin/plugin.json or at least one of: themes/, templates/, skills/.",
      );
    }

    const prev = await readManifest(dir);
    const prevBySource = new Map(
      (prev?.items ?? []).map((item) => [
        item.source,
        normalizePluginItem(item),
      ]),
    );
    const scanned = await buildIndexItems(dir);
    const items = scanned.map((item) => {
      const previous = prevBySource.get(item.source);
      if (!previous) return item;

      return {
        ...item,
        title: item.title ?? previous.title,
        description: item.description ?? previous.description,
        license: item.license ?? previous.license,
        author: item.author ?? previous.author,
        homepage: item.homepage ?? previous.homepage,
        tags: item.tags ?? previous.tags,
        category: item.category ?? previous.category,
        previews: item.previews ?? previous.previews,
        prompt: item.prompt ?? previous.prompt,
      };
    });

    if (opts.capturePreviews) {
      for (const item of items) {
        await capturePreviewsForItem(dir, item, {
          force: opts.forcePreviews,
        });
      }
    } else {
      for (const item of items) {
        await normalizePreviewRefs(dir, item);
      }
    }

    const manifest: PluginManifest = {
      name: opts.name?.trim() || prev?.name || titleFromId(path.basename(dir)),
      description: opts.description?.trim() || prev?.description,
      author: opts.author ?? prev?.author,
      homepage: opts.homepage?.trim() || prev?.homepage,
      license: opts.license?.trim() || prev?.license,
      items,
    };

    await writeManifest(dir, manifest);

    return { manifestFile: manifestPath(dir), dir, manifest };
  }

  export async function indexCollection(opts: {
    dir?: string;
    name?: string;
    description?: string;
  }) {
    const dir = path.resolve(opts.dir ?? process.cwd());
    const prev = await readMarketplace(marketplaceFile(dir));
    const plugins: MarketplacePlugin[] = [];

    for (const name of await dirs(dir)) {
      const pluginDir = path.join(dir, name);
      if (!(await valid(pluginDir))) continue;

      const manifest = await readManifest(pluginDir);
      if (!manifest) continue;

      plugins.push({
        name: manifest.name,
        source: `./${name}`,
        plugin: manifest,
      });
    }

    plugins.sort((a, b) => a.name.localeCompare(b.name));

    const marketplace: Marketplace = {
      version: (prev?.version ?? 0) + 1,
      name: opts.name?.trim() || prev?.name || titleFromId(path.basename(dir)),
      description: opts.description?.trim() || prev?.description,
      plugins,
    };

    const file = marketplaceFile(dir);
    await writeMarketplace(file, marketplace);

    return { marketplaceFile: file, dir, marketplace };
  }

  export async function index(opts: {
    dir?: string;
    id?: string;
    name?: string;
    description?: string;
    source?: string;
    collection?: boolean;
    author?: ItemMetadata["author"];
    homepage?: string;
    license?: string;
    capturePreviews?: boolean;
    forcePreviews?: boolean;
  }) {
    const dir = path.resolve(opts.dir ?? process.cwd());
    const asCollection = opts.collection ?? (await isCollectionRoot(dir));

    if (asCollection) {
      for (const name of await dirs(dir)) {
        const pluginDir = path.join(dir, name);
        if (!(await valid(pluginDir))) continue;
        await indexPlugin({
          dir: pluginDir,
          capturePreviews: opts.capturePreviews,
          forcePreviews: opts.forcePreviews,
        });
      }
      return indexCollection({
        dir,
        name: opts.name,
        description: opts.description,
      });
    }

    return indexPlugin({
      dir,
      name: opts.name ?? (opts.id ? titleFromId(opts.id) : undefined),
      description: opts.description,
      source: opts.source,
      author: opts.author,
      homepage: opts.homepage,
      license: opts.license,
      capturePreviews: opts.capturePreviews,
      forcePreviews: opts.forcePreviews,
    });
  }

  async function buildList(base: string): Promise<ListPack[]> {
    await ensure(base);

    return (await pairs(base)).map(({ item, entries }) => ({
      id: item.id,
      marketplace: item.marketplace,
      name: item.name,
      description: item.description,
      author: item.author,
      homepage: item.homepage,
      license: item.license,
      items: entries
        .map((entry) => entryToListItem(item, entry))
        .sort(
          (a, b) =>
            a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title),
        ),
    }));
  }

  export function list(base: string) {
    const key = path.resolve(base);
    const pending = inflight.get(key);
    if (pending) return pending;

    const promise = buildList(base).finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  export type ItemLocation = {
    dir: string;
    /** Primary file to read first (template HTML, SKILL.md, DESIGN.md). */
    focusFile?: string;
  };

  function defaultFocusRel(kind: PluginKind, entry: Entry): string {
    if (entry.prompt) return entry.prompt.replace(/^\.\//, "");
    if (kind === "skills") return "SKILL.md";
    return "DESIGN.md";
  }

  /** Resolve an installed plugin item directory and its primary focus file. */
  export async function itemLocation(
    base: string,
    itemId: string,
    kind: PluginKind,
  ): Promise<ItemLocation | null> {
    await ensure(base);

    for (const { item, entries } of await pairs(base)) {
      const entry = entryFor(entries, itemId, kind);
      if (!entry) continue;

      const rel = entry.source.replace(/^\.\//, "");
      const dir = path.join(item.absolute, rel);
      if (!(await Filesystem.isDir(dir))) continue;

      if (kind === "templates") {
        const focusFile = await templateFocusFile(dir, entry);
        return { dir, ...(focusFile ? { focusFile } : {}) };
      }

      const focusRel = defaultFocusRel(kind, entry);
      return { dir, focusFile: path.join(dir, focusRel) };
    }

    return null;
  }

  /** Drop the memoized catalog so the next read reflects on-disk changes. */
  export function invalidate(base?: string) {
    if (base) inflight.delete(path.resolve(base));
    else inflight.clear();
  }

  /** Remove an installed marketplace namespace (official cannot be removed). */
  export async function remove(id: string) {
    const clean = sanitizeMarketplaceId(id);
    if (!clean || clean === OFFICIAL) {
      throw new Error("The official marketplace cannot be removed.");
    }

    const registry = await readRegistry();
    const existed = registry?.marketplaces.some((m) => m.id === clean) ?? false;

    await rm(marketplaceDir(clean), { recursive: true, force: true });

    if (registry) {
      registry.marketplaces = registry.marketplaces.filter(
        (m) => m.id !== clean,
      );
      await writeRegistry(registry);
    }

    invalidate();
    return { id: clean, removed: existed };
  }

  export async function validate(dir?: string) {
    const packRoot = path.resolve(dir ?? process.cwd());
    const issues: Array<{ level: "error" | "warn"; message: string }> = [];
    const asCollection = await isCollectionRoot(packRoot);

    if (asCollection) {
      const collection = await readMarketplace(marketplaceFile(packRoot));
      if (!collection?.plugins?.length) {
        issues.push({
          level: "error",
          message: "Missing marketplace.json plugins.",
        });
      }
      for (const plugin of collection?.plugins ?? []) {
        const rel = plugin.source.replace(/^\.\//, "");
        const pluginDir = path.join(packRoot, rel);
        if (!plugin.plugin.items?.length) {
          issues.push({
            level: "warn",
            message: `${rel}: plugin has no items in marketplace.json.`,
          });
        }
        issues.push(
          ...(await validate(pluginDir)).map((issue) => ({
            ...issue,
            message: `${rel}: ${issue.message}`,
          })),
        );
      }
      return issues;
    }

    if (!(await Filesystem.exists(manifestPath(packRoot)))) {
      issues.push({
        level: "error",
        message: "Missing .dddx-plugin/plugin.json.",
      });
    }
    if (!(await valid(packRoot))) {
      issues.push({
        level: "error",
        message:
          "Expected .dddx-plugin/plugin.json or templates/, skills/, or themes/.",
      });
    }

    const manifest = await readManifest(packRoot);
    if (manifest && !manifest.items?.length) {
      issues.push({
        level: "warn",
        message: "plugin.json has no items. Run `dddx plugin index`.",
      });
    }

    for (const kind of KINDS) {
      const kindDir = path.join(packRoot, kind);
      if (!(await Filesystem.isDir(kindDir))) continue;
      for (const name of await dirs(kindDir)) {
        const itemDir = path.join(kindDir, name);
        if (kind === "templates") {
          const html = await firstHtmlInDir(itemDir);
          if (!html) {
            issues.push({
              level: "error",
              message: `${kind}/${name}: missing a prebuilt .html file (e.g. template.html).`,
            });
          }
        } else {
          const body = kind === "skills" ? "SKILL.md" : "DESIGN.md";
          if (!(await Filesystem.exists(path.join(kindDir, name, body)))) {
            issues.push({
              level: "error",
              message: `${kind}/${name}: missing ${body}.`,
            });
          }
        }
        if (!(await Filesystem.exists(path.join(kindDir, name, METADATA)))) {
          issues.push({
            level: "warn",
            message: `${kind}/${name}: missing metadata.json (will use defaults on index).`,
          });
        }
      }
    }

    return issues;
  }
}

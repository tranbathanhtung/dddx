/**
 * Official plugins marketplace on Cloudflare R2 (S3-compatible).
 *
 * Bucket layout (under R2_PREFIX, default "plugins"):
 *   plugins/official/marketplace.json
 *   plugins/official/official.tgz
 *
 * Runtime pulls use a public HTTPS base (DDDX_PLUGINS_R2_URL or R2_PUBLIC_BASE_URL).
 * Push/pull scripts may use R2_* credentials via @dddx/r2.
 */

import {
  createR2Client,
  fetchR2PublicBytes,
  fetchR2PublicJson,
  getR2ObjectBytes,
  putR2Object,
  requireR2Client,
  r2CredentialsFromEnv,
  r2PublicBaseUrl,
} from "@dddx/r2";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Filesystem } from "./filesystem";
import { production } from "./sdk-origin.ts";

/** Same public CDN as the SDK (`cdn.dddx.dev`). */
const PLUGINS_PUBLIC_BASE_DEFAULT = production;

export const R2_PREFIX = process.env.R2_PREFIX ?? "plugins";
export const OFFICIAL_MANIFEST_KEY = `${R2_PREFIX}/official/marketplace.json`;
export const OFFICIAL_TARBALL_KEY = `${R2_PREFIX}/official/official.tgz`;

export type OfficialManifest = {
  version?: number;
  name?: string;
  description?: string;
};

/** Public read base, e.g. https://<account>.r2.cloudflarestorage.com/<bucket> */
export function officialR2PublicBase(): string {
  return r2PublicBaseUrl(["DDDX_PLUGINS_R2_URL", "R2_PUBLIC_BASE_URL"], {
    defaultUrl: PLUGINS_PUBLIC_BASE_DEFAULT,
  });
}

async function tar(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("tar", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `tar exited with code ${code}`));
    });
  });
}

export async function fetchOfficialManifest(): Promise<OfficialManifest | null> {
  const publicBase = officialR2PublicBase();
  const fromPublic = await fetchR2PublicJson<OfficialManifest>(
    publicBase,
    OFFICIAL_MANIFEST_KEY,
  );
  if (fromPublic) return fromPublic;

  const creds = r2CredentialsFromEnv();
  const client = createR2Client(creds);
  if (!client || !creds) return null;

  const bytes = await getR2ObjectBytes(
    client,
    creds.bucket,
    OFFICIAL_MANIFEST_KEY,
  );
  if (!bytes) return null;
  return JSON.parse(Buffer.from(bytes).toString("utf8")) as OfficialManifest;
}

async function downloadOfficialTarball(dest: string) {
  const publicBase = officialR2PublicBase();
  const fromPublic = await fetchR2PublicBytes(
    publicBase,
    OFFICIAL_TARBALL_KEY,
    120_000,
  );
  if (fromPublic) {
    await writeFile(dest, Buffer.from(fromPublic));
    return;
  }

  const creds = r2CredentialsFromEnv();
  const client = createR2Client(creds);
  if (!client || !creds) {
    throw new Error(
      "Could not download official plugins. Enable public access on the R2 bucket or set R2_* credentials.",
    );
  }

  const bytes = await getR2ObjectBytes(client, creds.bucket, OFFICIAL_TARBALL_KEY);
  if (!bytes) {
    throw new Error(`Official tarball not found: ${OFFICIAL_TARBALL_KEY}`);
  }
  await writeFile(dest, Buffer.from(bytes));
}

export type PullOfficialResult = {
  synced: boolean;
  version: number;
  from: "r2";
};

/**
 * Download the official marketplace tarball into `targetDir` when the remote
 * version is newer than local (or local is missing). Uses public URL when set.
 */
export async function pullOfficial(
  targetDir: string,
  opts?: { force?: boolean },
): Promise<PullOfficialResult> {
  const remote = await fetchOfficialManifest();
  if (!remote) {
    throw new Error(
      "Official plugins not found on R2. Set DDDX_PLUGINS_R2_URL to your public bucket URL.",
    );
  }

  const localFile = path.join(targetDir, "marketplace.json");
  const local = existsSync(localFile)
    ? await Filesystem.readJsonIfValid<OfficialManifest>(localFile)
    : null;
  const localVersion = local?.version ?? -1;
  const remoteVersion = remote.version ?? 0;

  if (
    !opts?.force &&
    local &&
    localVersion >= remoteVersion &&
    (await Filesystem.isDir(targetDir))
  ) {
    return { synced: false, version: localVersion, from: "r2" };
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "dddx-official-"));
  const tarball = path.join(tmp, "official.tgz");
  const staging = path.join(
    path.dirname(targetDir),
    `${path.basename(targetDir)}.staging`,
  );
  try {
    await downloadOfficialTarball(tarball);
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true });
    await tar(["-xzf", tarball, "-C", staging]);

    const stagedManifest = await Filesystem.readJsonIfValid<{
      version?: number;
      plugins?: unknown[];
    }>(path.join(staging, "marketplace.json"));
    if (!stagedManifest?.plugins?.length) {
      throw new Error(
        "Downloaded official plugins tarball is missing a valid marketplace.json",
      );
    }

    await rm(targetDir, { recursive: true, force: true });
    await rename(staging, targetDir);
    return { synced: true, version: remoteVersion, from: "r2" };
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(tmp, { recursive: true, force: true });
  }
}

export async function pushOfficial(sourceDir: string) {
  const manifestPath = path.join(sourceDir, "marketplace.json");
  if (!(await Filesystem.exists(manifestPath))) {
    throw new Error(`No marketplace.json in ${sourceDir}`);
  }

  const { client, bucket } = requireR2Client();

  const tmp = await mkdtemp(path.join(os.tmpdir(), "dddx-r2-push-"));
  const tarball = path.join(tmp, "official.tgz");
  try {
    await tar([
      "--exclude=node_modules",
      "--exclude=package.json",
      "--exclude=.git",
      "-czf",
      tarball,
      "-C",
      sourceDir,
      ".",
    ]);

    await putR2Object(
      client,
      bucket,
      OFFICIAL_MANIFEST_KEY,
      await readFile(manifestPath),
      "application/json",
    );
    await putR2Object(
      client,
      bucket,
      OFFICIAL_TARBALL_KEY,
      await readFile(tarball),
      "application/gzip",
    );

    const manifest = await Filesystem.readJson<OfficialManifest>(manifestPath);
    return { version: manifest.version ?? 0 };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

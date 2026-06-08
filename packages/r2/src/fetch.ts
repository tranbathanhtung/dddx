import type { S3Client } from "@aws-sdk/client-s3";

import {
  createR2Client,
  getR2ObjectBytes,
  r2CredentialsFromEnv,
} from "./client";
import { r2PublicObjectUrl } from "./public";

export async function fetchR2PublicBytes(
  publicBase: string,
  key: string,
  timeoutMs = 120_000,
): Promise<Uint8Array | null> {
  if (!publicBase) return null;
  try {
    const res = await fetch(r2PublicObjectUrl(publicBase, key), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function fetchR2PublicJson<T>(
  publicBase: string,
  key: string,
  timeoutMs = 15_000,
): Promise<T | null> {
  const bytes = await fetchR2PublicBytes(publicBase, key, timeoutMs);
  if (!bytes) return null;
  return JSON.parse(Buffer.from(bytes).toString("utf8")) as T;
}

/**
 * Download an object via public HTTPS when available, otherwise authenticated S3.
 */
export async function getR2ObjectWithPublicFallback(
  publicBase: string,
  key: string,
  options?: { fetchTimeoutMs?: number; client?: S3Client | null },
): Promise<Uint8Array | null> {
  const fromPublic = await fetchR2PublicBytes(
    publicBase,
    key,
    options?.fetchTimeoutMs,
  );
  if (fromPublic) return fromPublic;

  const client = options?.client ?? createR2Client();
  const bucket = r2CredentialsFromEnv()?.bucket;
  if (!client || !bucket) return null;

  return getR2ObjectBytes(client, bucket, key);
}

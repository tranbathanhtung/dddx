import {
  GetObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";

import { loadMonorepoEnv } from "./env";

export type R2Credentials = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

const MISSING_CREDS =
  "Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET.";

function trimEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** Read Cloudflare R2 credentials from standard `R2_*` env vars. */
export function r2CredentialsFromEnv(): R2Credentials | null {
  const accountId = trimEnv("R2_ACCOUNT_ID");
  const accessKeyId = trimEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = trimEnv("R2_SECRET_ACCESS_KEY");
  const bucket = trimEnv("R2_BUCKET");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function requireR2Credentials(): R2Credentials {
  let creds = r2CredentialsFromEnv();
  if (!creds) {
    loadMonorepoEnv();
    creds = r2CredentialsFromEnv();
  }
  if (!creds) throw new Error(MISSING_CREDS);
  return creds;
}

/** S3-compatible client for Cloudflare R2. Returns null when credentials are unset. */
export function createR2Client(
  creds: R2Credentials | null = r2CredentialsFromEnv(),
): S3Client | null {
  if (!creds) return null;

  return new S3Client({
    region: "auto",
    endpoint: `https://${creds.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export function requireR2Client(): { client: S3Client; bucket: string } {
  const creds = requireR2Credentials();
  const client = createR2Client(creds);
  if (!client) throw new Error(MISSING_CREDS);
  return { client, bucket: creds.bucket };
}

export async function getR2ObjectBytes(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<Uint8Array | null> {
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = res.Body;
    if (!body) return null;
    return await body.transformToByteArray();
  } catch {
    return null;
  }
}

export async function putR2Object(
  client: S3Client,
  bucket: string,
  key: string,
  body: PutObjectCommandInput["Body"],
  contentType?: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ...(contentType ? { ContentType: contentType } : {}),
    }),
  );
}

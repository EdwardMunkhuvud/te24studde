import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const mediaPrefix = "media/";

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME,
  );
}

export function getR2Config() {
  const accountId = required("R2_ACCOUNT_ID");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
  const bucket = required("R2_BUCKET_NAME");
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "";
  const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

  return {
    bucket,
    publicBaseUrl,
    client: new S3Client({
      credentials: { accessKeyId, secretAccessKey },
      endpoint,
      region: "auto",
    }),
  };
}

export async function listR2MediaObjects() {
  const { bucket, client } = getR2Config();
  const objects: _Object[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
      Prefix: mediaPrefix,
    }));

    objects.push(...(response.Contents ?? []));
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

export async function getR2Object(key: string) {
  const { bucket, client } = getR2Config();

  return client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
}

export async function getR2MediaUrl(key: string) {
  const { bucket, client, publicBaseUrl } = getR2Config();

  if (publicBaseUrl) {
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    return `${publicBaseUrl}/${encodedKey}`;
  }

  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 60 * 60 * 24 * 7,
  });
}

export function parseR2MediaKey(key: string) {
  const match = key.match(/^media\/(\d{4}-\d{2}-\d{2})\/(\d+)-(.+)$/);

  if (!match) {
    return null;
  }

  return {
    dateKey: match[1],
    name: match[3],
    timestamp: Number(match[2]),
  };
}

function required(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Miljövariabeln ${name} saknas.`);
  }

  return value;
}

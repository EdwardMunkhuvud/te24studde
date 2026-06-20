import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

import { getR2Config } from "./r2";

const thumbnailWidth = 640;
const thumbnailHeight = 480;

export function getR2ThumbnailKey(mediaKey: string) {
  if (!mediaKey.startsWith("media/")) {
    throw new Error("Ogiltig medianyckel.");
  }

  return `thumbnails/${mediaKey.slice("media/".length)}.webp`;
}

export async function ensureR2Thumbnail(mediaKey: string, force = false) {
  const { bucket, client } = getR2Config();
  const thumbnailKey = getR2ThumbnailKey(mediaKey);

  if (!force) {
    const existing = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: thumbnailKey })).catch(() => null);

    if (existing) {
      return "existing" as const;
    }
  }

  const original = await client.send(new GetObjectCommand({ Bucket: bucket, Key: mediaKey }));

  if (!original.Body || !original.ContentType?.startsWith("image/")) {
    return "unsupported" as const;
  }

  const thumbnail = await sharp(Buffer.from(await original.Body.transformToByteArray()))
    .rotate()
    .resize({
      fit: "cover",
      height: thumbnailHeight,
      position: "attention",
      width: thumbnailWidth,
      withoutEnlargement: true,
    })
    .webp({ effort: 4, quality: 66 })
    .toBuffer();

  await client.send(new PutObjectCommand({
    Body: thumbnail,
    Bucket: bucket,
    CacheControl: "public, max-age=31536000, immutable",
    ContentLength: thumbnail.length,
    ContentType: "image/webp",
    Key: thumbnailKey,
  }));

  return "created" as const;
}

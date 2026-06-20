import { timingSafeEqual } from "crypto";
import { Readable } from "stream";

import { PutObjectCommand } from "@aws-sdk/client-s3";

import { getR2Config, isR2Configured } from "../../../lib/r2";
import { ensureR2Thumbnail } from "../../../lib/r2-thumbnails";

export const dynamic = "force-dynamic";

const allowedContentTypes = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);
const maxFileSize = 500 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return Response.json({ error: "R2 är inte konfigurerat." }, { status: 503 });
  }

  const expectedPassword = process.env.COOLABILDER_UPLOAD_PASSWORD;
  const suppliedPassword = request.headers.get("x-upload-password") ?? "";

  if (!expectedPassword || !passwordMatches(suppliedPassword, expectedPassword)) {
    return Response.json({ error: "Fel uppladdningslösenord." }, { status: 401 });
  }

  const encodedName = request.headers.get("x-file-name") ?? "";
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  const fileSize = Number(request.headers.get("x-file-size"));
  const fileDate = request.headers.get("x-file-date") ?? "";
  const lastModified = Number(request.headers.get("x-file-last-modified"));

  if (!request.body || !encodedName) {
    return Response.json({ error: "Filen saknas." }, { status: 400 });
  }

  if (!allowedContentTypes.has(contentType)) {
    return Response.json({ error: "Filtypen stöds inte." }, { status: 415 });
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxFileSize) {
    return Response.json({ error: "Filen är tom eller större än 500 MB." }, { status: 413 });
  }

  if (!/^20\d{2}-[01]\d-[0-3]\d$/.test(fileDate)) {
    return Response.json({ error: "Datumet är ogiltigt." }, { status: 400 });
  }

  const originalName = decodeURIComponent(encodedName);
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Number.isFinite(lastModified) && lastModified > 0 ? Math.round(lastModified) : Date.now();
  const key = `media/${fileDate}/${timestamp}-${safeName}`;
  const { bucket, client } = getR2Config();

  await client.send(new PutObjectCommand({
    Body: Readable.fromWeb(request.body as never),
    Bucket: bucket,
    CacheControl: "public, max-age=31536000, immutable",
    ContentLength: fileSize,
    ContentType: contentType,
    Key: key,
    Metadata: {
      "captured-at": new Date(timestamp).toISOString(),
      "original-name": encodeURIComponent(originalName),
    },
  }));

  if (contentType.startsWith("image/")) {
    await ensureR2Thumbnail(key).catch((error) => console.error("Kunde inte skapa miniatyr:", error));
  }

  return Response.json({ key, name: originalName });
}

function passwordMatches(supplied: string, expected: string) {
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);

  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

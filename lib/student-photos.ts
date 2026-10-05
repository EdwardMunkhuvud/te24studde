import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Prisma, StudentPhoto } from "@prisma/client";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { getR2Config } from "@/lib/r2";
import { MAX_ATTACHMENTS, MAX_PHOTO_BYTES, type PhotoItem, type PhotoPage } from "@/lib/photo-types";

export class PhotoError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function photoItem(photo: StudentPhoto): PhotoItem {
  const href = `/api/student-photos/${photo.id}/image`;
  return {
    id: photo.id, fileName: photo.fileName, caption: photo.caption,
    uploaderName: photo.uploaderName, userId: photo.userId,
    createdAt: photo.createdAt.toISOString(), href, thumbnailHref: `${href}?size=thumbnail`,
  };
}

export async function getPhotoPage(userId?: string, cursor?: string): Promise<PhotoPage> {
  const where = { scope: "GALLERY", ...(userId ? { userId } : {}) };
  // Only accept a cursor belonging to this album/filter.
  const after = cursor ? await prisma.studentPhoto.findFirst({ where: { ...where, id: cursor } }) : null;
  if (cursor && !after) throw new PhotoError("Bildlistan har ändrats. Uppdatera sidan och försök igen.");
  const [rows, total] = await Promise.all([
    prisma.studentPhoto.findMany({
      where: { ...where, ...(after ? { OR: [
        { createdAt: { lt: after.createdAt } },
        { createdAt: after.createdAt, id: { lt: after.id } },
      ] } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 25,
    }),
    prisma.studentPhoto.count({ where }),
  ]);
  return { photos: rows.slice(0, 24).map(photoItem), nextCursor: rows.length > 24 ? rows[23].id : null, total };
}

export async function savePhoto(bytes: Buffer, input: {
  fileName: string; caption: string; scope: "GALLERY" | "ATTACHMENT";
  userId: string; uploaderName: string;
}) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new PhotoError("Välj en bild som är högst 25 MB.", 413);
  let thumbnail: Buffer;
  let contentType: string;
  let extension: string;
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    const formats: Record<string, [string, string]> = {
      jpeg: ["image/jpeg", "jpg"], png: ["image/png", "png"],
      webp: ["image/webp", "webp"], gif: ["image/gif", "gif"],
    };
    const format = metadata.format ? formats[metadata.format] : undefined;
    if (!format) throw new Error("unsupported");
    [contentType, extension] = format;
    thumbnail = await image.rotate().resize({ width: 720, height: 540, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  } catch {
    throw new PhotoError("Bilden gick inte att läsa. Välj en JPG, PNG, WebP eller GIF (högst 40 megapixel).", 415);
  }
  const id = randomUUID();
  // None of these objects match coolabilder's media/ or thumbnails/ prefixes.
  const directory = input.scope === "GALLERY" ? "student-photos/gallery" : "student-photos/attachments";
  const storageKey = `${directory}/${id}.${extension}`;
  const thumbnailKey = `${directory}/${id}-thumb.webp`;
  const { bucket, client } = getR2Config();
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: bytes, ContentType: contentType, ContentLength: bytes.length }));
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: thumbnailKey, Body: thumbnail, ContentType: "image/webp", ContentLength: thumbnail.length }));
    return await prisma.studentPhoto.create({ data: { ...input, storageKey, thumbnailKey, contentType, byteSize: bytes.length } });
  } catch (error) {
    await Promise.allSettled([storageKey, thumbnailKey].map((Key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key }))));
    throw error;
  }
}

export function attachmentIds(formData: FormData) {
  const entries = formData.getAll("photoIds");
  if (entries.some((id) => typeof id !== "string" || !id || id.length > 100) || entries.length > MAX_ATTACHMENTS) {
    throw new PhotoError(`Välj högst ${MAX_ATTACHMENTS} bilder.`);
  }
  return [...new Set(entries as string[])];
}

export async function syncAttachments(tx: Prisma.TransactionClient, ids: string[], userId: string, parent: { announcementId: string } | { pollId: string }) {
  const rows = await tx.studentPhoto.findMany({ where: { id: { in: ids }, scope: "ATTACHMENT" } });
  const parentKey = "announcementId" in parent ? "announcementId" : "pollId";
  const parentId = "announcementId" in parent ? parent.announcementId : parent.pollId;
  if (rows.length !== ids.length || rows.some((photo) => {
    const alreadyHere = photo[parentKey] === parentId;
    const available = !photo.announcementId && !photo.pollId && photo.userId === userId;
    return !alreadyHere && !available;
  })) throw new PhotoError("En bild kunde inte kopplas till inlägget. Välj bilderna igen.");
  await tx.studentPhoto.updateMany({ where: { ...parent, id: { notIn: ids } }, data: { [parentKey]: null } });
  await tx.studentPhoto.updateMany({ where: { id: { in: ids } }, data: parent });
}

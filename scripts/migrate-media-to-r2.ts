import { createReadStream } from "fs";
import { open, readdir, readFile, stat } from "fs/promises";
import path from "path";

import {
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { getR2Config } from "../lib/r2";

const mediaDirectory = path.join(process.cwd(), "public", "coolabilder-media");
const envFiles = [".env.local", ".env"];
const supportedMedia = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".mov", ".m4v", ".webm"]);
const mp4Videos = new Set([".mp4", ".mov", ".m4v"]);
const mp4EpochOffsetSeconds = 2082844800;
const videoMetadataBytes = 2 * 1024 * 1024;

type LocalMedia = {
  absolutePath: string;
  contentType: string;
  key: string;
  name: string;
  size: number;
  timestamp: number;
};

async function main() {
  await loadLocalEnv();

  const { bucket, client } = getR2Config();
  const files = await findMedia(mediaDirectory);

  if (files.length === 0) {
    console.log("Inga mediafiler hittades i public/coolabilder-media.");
    return;
  }

  console.log(`Hittade ${files.length} filer (${formatBytes(sumBytes(files))}).`);

  let uploaded = 0;
  let skipped = 0;

  for (const [index, file] of files.entries()) {
    const existing = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: file.key })).catch(() => null);

    if (existing?.ContentLength === file.size) {
      skipped += 1;
      console.log(`[${index + 1}/${files.length}] Finns redan: ${file.name}`);
      continue;
    }

    await client.send(new PutObjectCommand({
      Body: createReadStream(file.absolutePath),
      Bucket: bucket,
      CacheControl: "public, max-age=31536000, immutable",
      ContentLength: file.size,
      ContentType: file.contentType,
      Key: file.key,
      Metadata: {
        "captured-at": new Date(file.timestamp).toISOString(),
        "original-name": encodeURIComponent(file.name),
      },
    }));

    uploaded += 1;
    console.log(`[${index + 1}/${files.length}] Uppladdad: ${file.name}`);
  }

  const remote = await listRemoteObjects();
  const remoteBytes = remote.reduce((total, item) => total + (item.Size ?? 0), 0);
  const localBytes = sumBytes(files);

  console.log("");
  console.log(`Klart. ${uploaded} uppladdade, ${skipped} hoppades över.`);
  console.log(`R2 innehåller ${remote.length} mediaobjekt (${formatBytes(remoteBytes)}).`);

  if (remote.length < files.length || remoteBytes < localBytes) {
    throw new Error("Verifieringen misslyckades: R2 har färre filer eller bytes än lokalmappen.");
  }

  console.log("Verifieringen lyckades. Lokalfilerna kan nu tas bort från Railway-repot.");

  async function listRemoteObjects() {
    const objects = [];
    let continuationToken: string | undefined;

    do {
      const response = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
        Prefix: "media/",
      }));

      objects.push(...(response.Contents ?? []));
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return objects;
  }
}

async function findMedia(directory: string, relativeDirectory = ""): Promise<LocalMedia[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const media: LocalMedia[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.join(relativeDirectory, entry.name);

    if (entry.isDirectory()) {
      media.push(...await findMedia(absolutePath, relativePath));
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();

    if (!supportedMedia.has(extension)) {
      continue;
    }

    const fileStat = await stat(absolutePath);
    const timestamp = await getMigrationTimestamp(absolutePath, entry.name, extension, fileStat.mtime.getTime());
    const dateKey = toDateKey(new Date(timestamp));
    const safeRelativePath = relativePath.replaceAll(path.sep, "-").replace(/[^a-zA-Z0-9._-]/g, "_");

    media.push({
      absolutePath,
      contentType: getContentType(extension),
      key: `media/${dateKey}/${Math.round(timestamp)}-${safeRelativePath}`,
      name: entry.name,
      size: fileStat.size,
      timestamp,
    });
  }

  return media.sort((a, b) => a.timestamp - b.timestamp || a.name.localeCompare(b.name, "sv-SE", { numeric: true }));
}

async function getMigrationTimestamp(absolutePath: string, fileName: string, extension: string, fallback: number) {
  const fileNameTimestamp = getTimestampFromFileName(fileName);

  if (fileNameTimestamp) {
    return fileNameTimestamp;
  }

  if (!mp4Videos.has(extension)) {
    return fallback;
  }

  const fileStat = await stat(absolutePath);
  const head = await readChunk(absolutePath, 0, videoMetadataBytes);
  const headTimestamp = findMvhdCreationTime(head);

  if (headTimestamp || fileStat.size <= videoMetadataBytes) {
    return headTimestamp ?? fallback;
  }

  const tail = await readChunk(
    absolutePath,
    Math.max(0, fileStat.size - videoMetadataBytes),
    videoMetadataBytes,
  );

  return findMvhdCreationTime(tail) ?? fallback;
}

function getTimestampFromFileName(fileName: string) {
  const match = fileName.match(/(20\d{2})[-_. ]?([01]\d)[-_. ]?([0-3]\d)(?:[-_. T]?([0-2]\d)([0-5]\d)([0-5]\d)?)?/);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();

  return Number.isNaN(parsed) ? null : parsed;
}

async function readChunk(absolutePath: string, position: number, length: number) {
  const file = await open(absolutePath, "r");

  try {
    const fileStat = await file.stat();
    const bytesToRead = Math.max(0, Math.min(length, fileStat.size - position));
    const buffer = Buffer.alloc(bytesToRead);
    const result = await file.read(buffer, 0, bytesToRead, position);

    return buffer.subarray(0, result.bytesRead);
  } finally {
    await file.close();
  }
}

function findMvhdCreationTime(buffer: Buffer) {
  const typeOffset = buffer.indexOf("mvhd", 0, "ascii");

  if (typeOffset === -1 || typeOffset + 12 > buffer.length) {
    return null;
  }

  const start = typeOffset + 4;
  const version = buffer[start];
  const creationSeconds = version === 1
    ? Number(buffer.readBigUInt64BE(start + 4))
    : buffer.readUInt32BE(start + 4);

  if (!creationSeconds || creationSeconds < mp4EpochOffsetSeconds) {
    return null;
  }

  return (creationSeconds - mp4EpochOffsetSeconds) * 1000;
}

async function loadLocalEnv() {
  for (const fileName of envFiles) {
    const filePath = path.join(process.cwd(), fileName);
    const content = await readFile(filePath, "utf8").catch(() => "");

    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

      if (!match || process.env[match[1]]) {
        continue;
      }

      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getContentType(extension: string) {
  const contentTypes: Record<string, string> = {
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".m4v": "video/x-m4v",
    ".mov": "video/quicktime",
    ".mp4": "video/mp4",
    ".png": "image/png",
    ".webm": "video/webm",
    ".webp": "image/webp",
  };

  return contentTypes[extension] ?? "application/octet-stream";
}

function sumBytes(files: LocalMedia[]) {
  return files.reduce((total, file) => total + file.size, 0);
}

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

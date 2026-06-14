/* eslint-disable @next/next/no-img-element */
import { open, readdir, stat } from "fs/promises";
import path from "path";

import styles from "./coolabilder.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MediaItem = {
  dateKey: string;
  dateLabel: string;
  href: string;
  kind: "Bild" | "Video";
  name: string;
  sizeLabel: string;
  timestamp: number;
};

const mediaDirectory = path.join(process.cwd(), "public", "coolabilder-media");
const publicBasePath = "/coolabilder-media";
const supportedImages = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const supportedVideos = new Set([".mp4", ".mov", ".m4v", ".webm"]);
const jpegImages = new Set([".jpg", ".jpeg"]);
const mp4Videos = new Set([".mp4", ".mov", ".m4v"]);
const mp4EpochOffsetSeconds = 2082844800;
const jpegMetadataBytes = 512 * 1024;
const videoMetadataBytes = 2 * 1024 * 1024;
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

async function getMediaFiles(directory: string, relativeDirectory = ""): Promise<MediaItem[]> {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const items = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.join(relativeDirectory, entry.name);

      if (entry.isDirectory()) {
        return getMediaFiles(absolutePath, relativePath);
      }

      const extension = path.extname(entry.name).toLowerCase();
      const isImage = supportedImages.has(extension);
      const isVideo = supportedVideos.has(extension);

      if (!isImage && !isVideo) {
        return [];
      }

      const fileStat = await stat(absolutePath);
      const timestamp = await getBestTimestamp(absolutePath, entry.name, extension, fileStat.mtime.getTime());
      const date = new Date(timestamp);
      const href = `${publicBasePath}/${relativePath.replaceAll(path.sep, "/")}`;

      const item: MediaItem = {
        dateKey: toDateKey(date),
        dateLabel: formatDate(date),
        href,
        kind: isImage ? "Bild" : "Video",
        name: entry.name,
        sizeLabel: formatSize(fileStat.size),
        timestamp,
      };

      return [
        item,
      ];
    }),
  );

  return items.flat();
}

async function getBestTimestamp(absolutePath: string, fileName: string, extension: string, fallback: number) {
  const fileNameTimestamp = getTimestampFromFileName(fileName);

  if (fileNameTimestamp) {
    return fileNameTimestamp;
  }

  const metadataTimestamp = await getMetadataTimestamp(absolutePath, extension);

  return metadataTimestamp ?? fallback;
}

function getTimestampFromFileName(fileName: string) {
  const isoMatch = fileName.match(/(20\d{2})[-_. ]?([01]\d)[-_. ]?([0-3]\d)(?:[-_. T]?([0-2]\d)([0-5]\d)([0-5]\d)?)?/);
  const swedishMatch = fileName.match(/([0-3]\d)[-_. ]([01]\d)[-_. ](20\d{2})(?:[-_. T]?([0-2]\d)([0-5]\d)([0-5]\d)?)?/);
  const dateMatch = isoMatch ?? swedishMatch;

  if (!dateMatch) {
    return null;
  }

  const [, first, second, third, hour = "00", minute = "00", secondValue = "00"] = dateMatch;
  const year = first.length === 4 ? first : third;
  const month = second;
  const day = first.length === 4 ? third : first;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(secondValue),
  ).getTime();

  return Number.isNaN(parsed) ? null : parsed;
}

async function getMetadataTimestamp(absolutePath: string, extension: string) {
  try {
    if (jpegImages.has(extension)) {
      return getJpegExifTimestamp(await readFileChunk(absolutePath, 0, jpegMetadataBytes));
    }

    if (mp4Videos.has(extension)) {
      return getMp4CreationTimestamp(absolutePath);
    }
  } catch {
    return null;
  }

  return null;
}

async function readFileChunk(absolutePath: string, position: number, length: number) {
  const file = await open(absolutePath, "r");

  try {
    const stats = await file.stat();
    const bytesToRead = Math.max(0, Math.min(length, stats.size - position));
    const buffer = Buffer.alloc(bytesToRead);
    const result = await file.read(buffer, 0, bytesToRead, position);

    return buffer.subarray(0, result.bytesRead);
  } finally {
    await file.close();
  }
}

function getJpegExifTimestamp(buffer: Buffer) {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) {
    return null;
  }

  let offset = 2;

  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (marker === 0xe1 && buffer.toString("ascii", offset + 4, offset + 10) === "Exif\0\0") {
      return readExifDate(buffer.subarray(offset + 10, offset + 2 + segmentLength));
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function readExifDate(tiff: Buffer) {
  if (tiff.length < 14) {
    return null;
  }

  const littleEndian = tiff.toString("ascii", 0, 2) === "II";
  const bigEndian = tiff.toString("ascii", 0, 2) === "MM";

  if (!littleEndian && !bigEndian) {
    return null;
  }

  const readUInt16 = (offset: number) => littleEndian ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset);
  const readUInt32 = (offset: number) => littleEndian ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset);
  const firstIfdOffset = readUInt32(4);
  const ifd0 = readIfdEntries(tiff, firstIfdOffset, readUInt16, readUInt32);
  const exifIfdPointer = ifd0.get(0x8769)?.valueOffset;
  const exifIfd = exifIfdPointer ? readIfdEntries(tiff, exifIfdPointer, readUInt16, readUInt32) : new Map<number, ExifEntry>();
  const dateTags = [0x9003, 0x9004, 0x0132];

  for (const tag of dateTags) {
    const entry = exifIfd.get(tag) ?? ifd0.get(tag);
    const rawDate = entry ? readExifAscii(tiff, entry) : null;
    const timestamp = rawDate ? parseExifDate(rawDate) : null;

    if (timestamp) {
      return timestamp;
    }
  }

  return null;
}

type ExifEntry = {
  count: number;
  type: number;
  valueOffset: number;
};

function readIfdEntries(
  tiff: Buffer,
  ifdOffset: number,
  readUInt16: (offset: number) => number,
  readUInt32: (offset: number) => number,
) {
  const entries = new Map<number, ExifEntry>();

  if (ifdOffset < 0 || ifdOffset + 2 > tiff.length) {
    return entries;
  }

  const entryCount = readUInt16(ifdOffset);

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;

    if (entryOffset + 12 > tiff.length) {
      break;
    }

    entries.set(readUInt16(entryOffset), {
      type: readUInt16(entryOffset + 2),
      count: readUInt32(entryOffset + 4),
      valueOffset: readUInt32(entryOffset + 8),
    });
  }

  return entries;
}

function readExifAscii(tiff: Buffer, entry: ExifEntry) {
  if (entry.type !== 2) {
    return null;
  }

  const valueLength = entry.count;
  const valueStart = valueLength <= 4 ? tiff.byteOffset + 0 : entry.valueOffset;
  const start = valueLength <= 4 ? -1 : valueStart;

  if (start < 0 || start + valueLength > tiff.length) {
    return null;
  }

  return tiff.toString("ascii", start, start + valueLength).replace(/\0/g, "").trim();
}

function parseExifDate(rawDate: string) {
  const match = rawDate.match(/(20\d{2}):([01]\d):([0-3]\d)\s+([0-2]\d):([0-5]\d):([0-5]\d)/);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ).getTime();

  return Number.isNaN(parsed) ? null : parsed;
}

async function getMp4CreationTimestamp(absolutePath: string) {
  const stats = await stat(absolutePath);
  const head = await readFileChunk(absolutePath, 0, videoMetadataBytes);
  const headTimestamp = findMvhdCreationTime(head);

  if (headTimestamp) {
    return headTimestamp;
  }

  if (stats.size <= videoMetadataBytes) {
    return null;
  }

  const tailStart = Math.max(0, stats.size - videoMetadataBytes);
  const tail = await readFileChunk(absolutePath, tailStart, videoMetadataBytes);

  return findMvhdCreationTime(tail);
}

function findMvhdCreationTime(buffer: Buffer) {
  let typeOffset = buffer.indexOf("mvhd", 0, "ascii");

  while (typeOffset !== -1) {
    const timestamp = readMvhdCreationTime(buffer, typeOffset + 4);

    if (timestamp) {
      return timestamp;
    }

    typeOffset = buffer.indexOf("mvhd", typeOffset + 4, "ascii");
  }

  return null;
}

function readMvhdCreationTime(buffer: Buffer, start: number) {
  if (start + 8 > buffer.length) {
    return null;
  }

  const version = buffer[start];
  const requiredLength = version === 1 ? start + 12 : start + 8;

  if (requiredLength > buffer.length) {
    return null;
  }

  const creationSeconds = version === 1
    ? Number(buffer.readBigUInt64BE(start + 4))
    : buffer.readUInt32BE(start + 4);

  if (!creationSeconds || creationSeconds < mp4EpochOffsetSeconds) {
    return null;
  }

  return (creationSeconds - mp4EpochOffsetSeconds) * 1000;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function groupByDate(items: MediaItem[]) {
  const groups = new Map<string, MediaItem[]>();

  items.forEach((item) => {
    const group = groups.get(item.dateKey) ?? [];
    group.push(item);
    groups.set(item.dateKey, group);
  });

  return Array.from(groups.entries()).map(([dateKey, groupItems]) => ({
    dateKey,
    dateLabel: groupItems[0]?.dateLabel ?? dateKey,
    items: groupItems.sort(compareMediaItems),
  }));
}

function compareMediaItems(a: MediaItem, b: MediaItem) {
  return b.timestamp - a.timestamp || a.name.localeCompare(b.name, "sv-SE", { numeric: true });
}

export default async function CoolaBilderPage() {
  const media = isProductionBuild
    ? []
    : (await getMediaFiles(mediaDirectory)).sort(compareMediaItems);
  const groups = groupByDate(media);
  const imageCount = media.filter((item) => item.kind === "Bild").length;
  const videoCount = media.filter((item) => item.kind === "Video").length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Hemligt resebibliotek</span>
          <h1>Coola bilder</h1>
          <p>
            Ett enkelt mediebibliotek för resor, sorterat efter datum. Lägg bilder och videor i
            mappen, så dyker de upp här automatiskt.
          </p>
          <div className={styles.summary}>
            <span className={styles.pill}>{media.length} filer</span>
            <span className={styles.pill}>{imageCount} bilder</span>
            <span className={styles.pill}>{videoCount} videor</span>
          </div>
        </section>

        {media.length === 0 ? (
          <section className={styles.empty}>
            <strong>Inga medier än.</strong>
            <span>Lägg filer i public/coolabilder-media och ladda om sidan.</span>
          </section>
        ) : (
          groups.map((group) => (
            <section className={styles.dateGroup} key={group.dateKey}>
              <div className={styles.dateHeading}>
                <h2>{group.dateLabel}</h2>
                <span>{group.items.length} filer</span>
              </div>
              <div className={styles.grid}>
                {group.items.map((item) => (
                  <article className={styles.card} key={item.href}>
                    <a className={styles.mediaLink} href={item.href}>
                      {item.kind === "Bild" ? (
                        <img className={styles.preview} src={item.href} alt={item.name} loading="lazy" />
                      ) : (
                        <div className={styles.videoWrap}>
                          <video preload="metadata" src={item.href} muted playsInline />
                          <span className={styles.typeBadge}>Video</span>
                        </div>
                      )}
                    </a>
                    <div className={styles.meta}>
                      <span className={styles.name} title={item.name}>
                        {item.name}
                      </span>
                      <div className={styles.details}>
                        <span>{item.kind}</span>
                        <span>{item.sizeLabel}</span>
                      </div>
                      <a className={styles.download} href={item.href} download>
                        Ladda ner
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}

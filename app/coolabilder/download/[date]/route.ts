import { createReadStream } from "fs";
import { open, readdir, stat } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

type ImageFile = {
  absolutePath: string;
  dateKey: string;
  name: string;
  relativePath: string;
  timestamp: number;
};

const mediaDirectory = path.join(process.cwd(), "public", "coolabilder-media");
const supportedImages = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const jpegImages = new Set([".jpg", ".jpeg"]);
const jpegMetadataBytes = 512 * 1024;

export async function GET(_request: Request, { params }: { params: { date: string } }) {
  const date = params.date;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Ogiltigt datum.", { status: 400 });
  }

  const images = (await getImageFiles(mediaDirectory))
    .filter((item) => item.dateKey === date)
    .sort(compareImageFiles);

  if (images.length === 0) {
    return new Response("Det finns inga bilder för det datumet.", { status: 404 });
  }

  const zip = createZipStream(images);

  return new Response(zip, {
    headers: {
      "Content-Disposition": `attachment; filename="coolabilder-${date}.zip"`,
      "Content-Type": "application/zip",
    },
  });
}

async function getImageFiles(directory: string, relativeDirectory = ""): Promise<ImageFile[]> {
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
        return getImageFiles(absolutePath, relativePath);
      }

      const extension = path.extname(entry.name).toLowerCase();

      if (!supportedImages.has(extension)) {
        return [];
      }

      const fileStat = await stat(absolutePath);
      const timestamp = await getBestTimestamp(absolutePath, entry.name, extension, fileStat.mtime.getTime());
      const dateKey = new Date(timestamp).toISOString().slice(0, 10);

      return [
        {
          absolutePath,
          dateKey,
          name: entry.name,
          relativePath: relativePath.replaceAll(path.sep, "/"),
          timestamp,
        },
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

  if (jpegImages.has(extension)) {
    const exifTimestamp = await getJpegExifTimestamp(await readFileChunk(absolutePath, 0, jpegMetadataBytes));

    if (exifTimestamp) {
      return exifTimestamp;
    }
  }

  return fallback;
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
  if (entry.type !== 2 || entry.count <= 4 || entry.valueOffset + entry.count > tiff.length) {
    return null;
  }

  return tiff.toString("ascii", entry.valueOffset, entry.valueOffset + entry.count).replace(/\0/g, "").trim();
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

function compareImageFiles(a: ImageFile, b: ImageFile) {
  return b.timestamp - a.timestamp || a.name.localeCompare(b.name, "sv-SE", { numeric: true });
}

function createZipStream(files: ImageFile[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      writeZip(files, controller)
        .then(() => controller.close())
        .catch((error) => controller.error(error));
    },
  });
}

async function writeZip(files: ImageFile[], controller: ReadableStreamDefaultController<Uint8Array>) {
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const fileName = Buffer.from(file.relativePath, "utf8");
    const fileStat = await stat(file.absolutePath);
    const { dosDate, dosTime } = toDosDateTime(new Date(file.timestamp));
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0808, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(0, 18);
    localHeader.writeUInt32LE(0, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    controller.enqueue(localHeader);
    controller.enqueue(fileName);

    let crc = 0xffffffff;

    for await (const chunk of createReadStream(file.absolutePath)) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      crc = crc32Update(crc, buffer);
      controller.enqueue(buffer);
    }

    crc = (crc ^ 0xffffffff) >>> 0;

    const dataDescriptor = Buffer.alloc(16);

    dataDescriptor.writeUInt32LE(0x08074b50, 0);
    dataDescriptor.writeUInt32LE(crc, 4);
    dataDescriptor.writeUInt32LE(fileStat.size, 8);
    dataDescriptor.writeUInt32LE(fileStat.size, 12);
    controller.enqueue(dataDescriptor);

    const centralHeader = Buffer.alloc(46);

    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0808, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(fileStat.size, 20);
    centralHeader.writeUInt32LE(fileStat.size, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileName);
    offset += localHeader.length + fileName.length + fileStat.size + dataDescriptor.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);

  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.length, 8);
  endOfCentralDirectory.writeUInt16LE(files.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  controller.enqueue(centralDirectory);
  controller.enqueue(endOfCentralDirectory);
}

function toDosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());

  return {
    dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function crc32Update(crc: number, buffer: Buffer) {
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return crc >>> 0;
}

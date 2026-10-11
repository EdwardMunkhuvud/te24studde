import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getR2Config, isR2Configured } from "@/lib/r2";
import { MAX_STUDY_BYTES, type StudyData } from "@/lib/study-types";

export class StudyError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const short = (max: number) => z.string().trim().max(max);
const required = (max: number) => short(max).min(1);
export const examInput = z.object({
  title: required(150), subject: required(60), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
    const parsed = new Date(`${date}T12:00:00Z`);
    return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }), time: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
  location: short(150), description: short(3000),
}).refine((exam) => !exam.endTime || Boolean(exam.time && exam.endTime > exam.time), "Sluttiden måste vara efter starttiden.");
export const materialInput = z.object({
  examId: required(100), title: required(150), description: short(1500),
  sortOrder: z.number().int().min(0).max(999),
});
export const linkInput = z.string().trim().max(2000).url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
});
export const highlightsInput = z.array(z.object({
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  width: z.number().positive().max(1), height: z.number().positive().max(1),
}).refine((rect) => rect.x + rect.width <= 1.000001 && rect.y + rect.height <= 1.000001)).max(100);
export const noteInput = z.object({
  materialId: required(100), body: required(4000), quote: short(1000), section: short(150),
  page: z.number().int().min(1).max(100000).nullable(),
  x: z.number().min(0).max(1).nullable(), y: z.number().min(0).max(1).nullable(),
  seconds: z.number().int().min(0).max(86400).nullable(),
  highlights: highlightsInput.default([]),
}).refine((note) => (note.x === null) === (note.y === null));

function readHighlights(value: string) {
  try { const parsed = highlightsInput.safeParse(JSON.parse(value)); return parsed.success ? parsed.data : []; }
  catch { return []; }
}

export async function getStudyData(userId: string, admin = false): Promise<StudyData> {
  const exams = await prisma.studyExam.findMany({
    where: admin ? {} : { archived: false }, orderBy: [{ date: "asc" }, { time: "asc" }, { title: "asc" }],
    include: { materials: {
      where: admin ? {} : { archived: false }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { notes: { where: { userId }, orderBy: { updatedAt: "desc" } }, progress: { where: { userId } } },
    } },
  });
  return { exams: exams.map((exam) => ({
    id: exam.id, title: exam.title, subject: exam.subject, date: exam.date, time: exam.time,
    endTime: exam.endTime, location: exam.location, description: exam.description, archived: exam.archived,
    materials: exam.materials.map((m) => ({
      id: m.id, examId: m.examId, title: m.title, description: m.description,
      kind: m.kind as "PDF" | "IMAGE" | "AUDIO" | "LINK", url: m.url,
      fileName: m.fileName, byteSize: m.byteSize, sortOrder: m.sortOrder, archived: m.archived,
      completed: m.progress[0]?.completed ?? false,
      notes: m.notes.map((n) => ({ id: n.id, body: n.body, quote: n.quote, section: n.section,
        page: n.page, x: n.x, y: n.y, seconds: n.seconds, highlights: readHighlights(n.highlights), updatedAt: n.updatedAt.toISOString() })),
    })),
  })) };
}

export async function availableExam(id: string) {
  const exam = await prisma.studyExam.findFirst({ where: { id, archived: false } });
  if (!exam) throw new StudyError("Provet finns inte eller är arkiverat.", 404);
  return exam;
}
export async function availableMaterial(id: string) {
  const material = await prisma.studyMaterial.findFirst({ where: { id, archived: false, exam: { archived: false } } });
  if (!material) throw new StudyError("Materialet finns inte eller är arkiverat.", 404);
  return material;
}

// Stored next to the SQLite database, so Railway's existing persistent volume also keeps study files.
export function studyStorageDirectory() {
  if (process.env.STUDY_STORAGE_DIR) return resolve(process.env.STUDY_STORAGE_DIR);
  const databasePath = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "").split("?")[0];
  return join(dirname(resolve(process.cwd(), "prisma", databasePath)), "study-materials");
}
export function localStudyPath(key: string) {
  if (!/^[a-f0-9-]{36}\.(pdf|jpg|png|webp|gif|mp3|wav|ogg|m4a)$/.test(key)) throw new StudyError("Ogiltig fil.", 404);
  return join(studyStorageDirectory(), key);
}
export async function deleteStudyMaterial(id: string) {
  const material = await prisma.studyMaterial.findUnique({ where: { id } });
  if (!material) throw new StudyError("Materialet hittades inte.", 404);
  // Remove the file first: failed storage deletion keeps the row available for an admin retry.
  if (material.storageKey) {
    try {
      if (material.storage === "R2") {
        if (!/^study-materials\/[a-f0-9-]{36}\.(pdf|jpg|png|webp|gif|mp3|wav|ogg|m4a)$/.test(material.storageKey)) throw new Error("Invalid study storage key");
        const { client, bucket } = getR2Config();
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: material.storageKey }));
      } else await unlink(localStudyPath(material.storageKey)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    } catch { throw new StudyError("Filen kunde inte tas bort. Materialet finns kvar så att du kan försöka igen.", 503); }
  }
  // The database cascades deletion to every user's notes and progress for this material only.
  await prisma.studyMaterial.deleteMany({ where: { id } });
}
export async function inspectStudyFile(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_STUDY_BYTES) throw new StudyError("Filen får vara högst 40 MB.", 413);
  if (bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) return { kind: "PDF", contentType: "application/pdf", extension: "pdf" };
  const header = bytes.subarray(0, 12);
  if (header.subarray(0, 3).toString() === "ID3" || (header[0] === 255 && (header[1] & 224) === 224)) return { kind: "AUDIO", contentType: "audio/mpeg", extension: "mp3" };
  if (header.subarray(0, 4).toString() === "RIFF" && header.subarray(8).toString() === "WAVE") return { kind: "AUDIO", contentType: "audio/wav", extension: "wav" };
  if (header.subarray(0, 4).toString() === "OggS") return { kind: "AUDIO", contentType: "audio/ogg", extension: "ogg" };
  if (header.subarray(4, 8).toString() === "ftyp" && /^(M4A |M4B |isom|mp42)$/.test(header.subarray(8).toString())) return { kind: "AUDIO", contentType: "audio/mp4", extension: "m4a" };
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" }).metadata();
    const types: Record<string, [string, string]> = { jpeg: ["image/jpeg", "jpg"], png: ["image/png", "png"], webp: ["image/webp", "webp"], gif: ["image/gif", "gif"] };
    const type = types[metadata.format ?? ""];
    if (type) return { kind: "IMAGE", contentType: type[0], extension: type[1] };
  } catch { /* Report a useful format error below. */ }
  throw new StudyError("Välj PDF, JPG, PNG, WebP, GIF, MP3, WAV, OGG eller M4A.", 415);
}
export async function saveStudyFile(bytes: Buffer, input: z.infer<typeof materialInput> & { fileName: string }) {
  await availableExam(input.examId);
  const type = await inspectStudyFile(bytes);
  const key = `${randomUUID()}.${type.extension}`;
  const storage = isR2Configured() ? "R2" : "LOCAL";
  const storageKey = storage === "R2" ? `study-materials/${key}` : key;
  if (storage === "R2") {
    const { client, bucket } = getR2Config();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: bytes, ContentType: type.contentType, ContentLength: bytes.length }));
  } else {
    await mkdir(studyStorageDirectory(), { recursive: true });
    await writeFile(localStudyPath(storageKey), bytes, { flag: "wx" });
  }
  try {
    return await prisma.$transaction(async (tx) => {
      if (!await tx.studyExam.findFirst({ where: { id: input.examId, archived: false } })) throw new StudyError("Provet har arkiverats. Välj ett annat prov.", 409);
      return tx.studyMaterial.create({ data: {
        ...input, kind: type.kind, contentType: type.contentType, byteSize: bytes.length, storage, storageKey,
      } });
    });
  } catch (error) {
    if (storage === "R2") {
      const { client, bucket } = getR2Config();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })).catch(() => {});
    } else await unlink(localStudyPath(storageKey)).catch(() => {});
    throw error;
  }
}

// Run after npm run build. All writes stay in a disposable database and temporary file/S3 storage.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import sharp from "sharp";
import { seedStudyExams } from "../lib/study-seed";
import { daysUntil, stockholmDate, type StudyData } from "../lib/study-types";

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "studde-study-"));
  const databaseUrl = `file:${join(directory, "test.db")}`;
  const secret = "isolated-study-integration-test";
  const env = { ...process.env, DATABASE_URL: databaseUrl, SESSION_SECRET: secret, STUDY_STORAGE_DIR: join(directory, "files"), R2_ACCOUNT_ID: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "", R2_BUCKET_NAME: "" };
  const setup = () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/setup-db.ts"], { env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  setup(); const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  let server: ReturnType<typeof spawn> | undefined;
  let objectServer: ReturnType<typeof createServer> | undefined;
  try {
    const users = await Promise.all(["Anna", "Bo", "Admin"].map((name) => db.user.create({ data: { name, username: `test-${name}`, passwordHash: "unused", role: name === "Admin" ? "ADMIN" : "STUDENT" } })));
    const original = await db.contribution.create({ data: { title: "Keep this", amount: 123, userId: users[0].id } });
    await seedStudyExams(db); assert.equal(await db.studyExam.count(), 13);
    const first = await db.studyExam.findFirstOrThrow({ orderBy: { date: "asc" } });
    assert.equal(first.date, "2026-10-16"); assert.equal(first.time, "12:45");
    await db.studyExam.update({ where: { id: first.id }, data: { title: "Edited by admin" } });
    setup(); await seedStudyExams(db);
    assert.equal(await db.studyExam.count(), 13);
    assert.equal((await db.studyExam.findUniqueOrThrow({ where: { id: first.id } })).title, "Edited by admin");
    assert.equal((await db.contribution.findUniqueOrThrow({ where: { id: original.id } })).amount, 123);
    assert.equal(stockholmDate(new Date("2026-10-11T22:30:00Z")), "2026-10-12");
    assert.equal(daysUntil("2026-10-26", "2026-10-24"), 2); // DST change does not alter the countdown.

    server = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", "0"], { env, stdio: ["ignore", "pipe", "pipe"] });
    let log = ""; server.stdout?.on("data", (chunk) => { log += chunk.toString(); }); server.stderr?.on("data", (chunk) => { log += chunk.toString(); });
    let base = "";
    for (let tries = 0; tries < 150; tries++) {
      base = log.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0] ?? "";
      if (base && log.includes("Ready")) break;
      if (server.exitCode !== null) throw new Error(log);
      await delay(100);
    }
    assert.ok(base && log.includes("Ready"), log);
    const cookies = await Promise.all(users.map(async (u) => `studde_session=${await new SignJWT({ userId: u.id, username: u.username, name: u.name, role: u.role }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(secret))}`));
    const headers = (user: number | null, origin = base) => ({ ...(user === null ? {} : { cookie: cookies[user] }), origin });
    const request = (user: number | null, body?: unknown, origin = base) => fetch(`${base}/api/study`, { method: body === undefined ? "GET" : "POST", headers: { ...headers(user, origin), "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const exam = { action: "exam-save", title: "Testprov", subject: "Matematik", date: "2027-01-10", time: "09:00", endTime: "10:00", location: "A1", description: "Repetera" };
    assert.equal((await request(null)).status, 401);
    assert.equal((await request(0, exam)).status, 403);
    assert.equal((await request(2, exam, "https://other.example")).status, 403);
    assert.equal((await request(2, null)).status, 400);
    assert.equal((await request(2, { ...exam, date: "2027-02-30" })).status, 400);
    assert.equal((await request(2, { ...exam, endTime: "08:00" })).status, 400);
    assert.equal((await request(2, exam)).status, 200);
    const created = await db.studyExam.findFirstOrThrow({ where: { title: "Testprov" } });
    const link = { action: "material-link", examId: created.id, title: "Repetitionsfrågor", description: "Börja här", sortOrder: 0, url: "https://example.com/study" };
    assert.equal((await request(0, link)).status, 403);
    assert.equal((await request(2, { ...link, url: "javascript:alert(1)" })).status, 400);
    assert.equal((await request(2, link)).status, 200);
    const linkRow = await db.studyMaterial.findFirstOrThrow({ where: { examId: created.id } });
    const upload = (user: number | null, bytes: Buffer, fileName = "material.pdf", origin = base) => fetch(`${base}/api/study/upload?examId=${created.id}`, { method: "POST", headers: { ...headers(user, origin), "x-file-name": encodeURIComponent(fileName), "x-study-title": "Testmaterial", "x-study-description": "Test" }, body: bytes });
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
    assert.equal((await upload(null, pdf)).status, 401);
    assert.equal((await upload(0, pdf)).status, 403);
    assert.equal((await upload(2, pdf, "x.pdf", "https://other.example")).status, 403);
    assert.equal((await upload(2, Buffer.from("<script>alert(1)</script>"), "x.pdf")).status, 415);
    const saved = await upload(2, pdf, "Övning.pdf"); assert.equal(saved.status, 201);
    const pdfId = (await saved.json()).id as string;
    const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#abcdef" } }).png().toBuffer();
    assert.equal((await upload(2, image, "image.png")).status, 201);
    const wave = Buffer.alloc(44); wave.write("RIFF", 0); wave.writeUInt32LE(36, 4); wave.write("WAVEfmt ", 8); wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22); wave.writeUInt32LE(8000, 24); wave.writeUInt32LE(16000, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write("data", 36);
    assert.equal((await upload(2, wave, "audio.wav")).status, 201);
    const content = `${base}/api/study/materials/${pdfId}/content`;
    assert.equal((await fetch(content)).status, 401);
    const downloaded = await fetch(content, { headers: headers(0) }); assert.equal(downloaded.status, 200); assert.equal(downloaded.headers.get("content-type"), "application/pdf"); assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), pdf);
    const range = await fetch(content, { headers: { ...headers(0), range: "bytes=2-6" } }); assert.equal(range.status, 206); assert.deepEqual(Buffer.from(await range.arrayBuffer()), pdf.subarray(2, 7));
    assert.equal((await fetch(content, { headers: { ...headers(0), range: "bytes=999999-" } })).status, 416);
    const note = { action: "note-save", materialId: pdfId, body: "Min egen förklaring", quote: "Citat", section: "Uppgift 4", page: 2, x: 0.4, y: 0.6, seconds: null, userId: users[1].id };
    assert.equal((await request(0, { ...note, x: 1.5 })).status, 400);
    assert.equal((await request(0, note)).status, 200);
    const noteRow = await db.studyNote.findFirstOrThrow(); assert.equal(noteRow.userId, users[0].id);
    assert.equal((await request(1, { ...note, id: noteRow.id, body: "Stolen" })).status, 404);
    assert.equal((await request(1, { action: "note-delete", id: noteRow.id })).status, 404);
    assert.equal((await request(0, { action: "progress", materialId: pdfId, completed: true })).status, 200);
    const own = await (await request(0)).json() as StudyData; const other = await (await request(1)).json() as StudyData; const admin = await (await request(2)).json() as StudyData;
    const material = (data: StudyData) => data.exams.flatMap((e) => e.materials).find((m) => m.id === pdfId)!;
    assert.equal(material(own).notes.length, 1); assert.equal(material(own).completed, true);
    assert.equal(material(other).notes.length, 0); assert.equal(material(other).completed, false); assert.equal(material(admin).notes.length, 0);
    assert.equal((await request(2, { action: "material-save", id: pdfId, examId: first.id, title: "Moved", description: "", sortOrder: 2 })).status, 200);
    assert.equal((await db.studyNote.findUniqueOrThrow({ where: { id: noteRow.id } })).materialId, pdfId);
    assert.equal((await request(2, { action: "material-archive", id: pdfId, archived: true })).status, 200);
    assert.equal((await fetch(content, { headers: headers(0) })).status, 404);
    assert.equal((await request(0, note)).status, 404);
    assert.equal((await request(2, { action: "material-archive", id: pdfId, archived: false })).status, 200);
    assert.equal(material(await (await request(0)).json()).notes.length, 1);
    assert.equal((await request(2, { action: "exam-archive", id: first.id, archived: true })).status, 200);
    assert.equal((await fetch(content, { headers: headers(0) })).status, 404);
    assert.equal((await request(2, { action: "exam-archive", id: first.id, archived: false })).status, 200);
    for (const [index, path] of [[0, "/student?tab=study"], [2, "/admin?tab=study"], [0, "/student"], [2, "/admin"]] as const) {
      const response = await fetch(base + path, { headers: headers(index) }); assert.equal(response.status, 200, path); assert.ok((await response.text()).includes("Studiehubb"));
    }
    // Role changes must take effect even when an old cookie still says ADMIN.
    await db.user.update({ where: { id: users[2].id }, data: { role: "STUDENT" } });
    assert.equal((await request(2, exam)).status, 403);
    await db.user.delete({ where: { id: users[1].id } }); assert.equal((await request(1)).status, 401);

    // A local S3-compatible server checks R2 isolation and byte-range streaming without real credentials.
    const objects = new Map<string, Buffer>();
    objectServer = createServer(async (req, res) => {
      const key = new URL(req.url!, "http://localhost").pathname;
      if (req.method === "PUT") { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk)); objects.set(key, Buffer.concat(chunks)); res.writeHead(200, { ETag: '"test"' }); res.end(); }
      else if (req.method === "GET") { const bytes = objects.get(key); if (!bytes) { res.writeHead(404); res.end(); return; } const match = /bytes=(\d+)-(\d+)/.exec(req.headers.range ?? ""); const start = match ? Number(match[1]) : 0, end = match ? Number(match[2]) : bytes.length - 1; res.writeHead(match ? 206 : 200, { "Content-Length": end - start + 1, "Content-Type": "application/pdf", ...(match ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` } : {}) }); res.end(bytes.subarray(start, end + 1)); }
      else if (req.method === "DELETE") { objects.delete(key); res.writeHead(204); res.end(); } else { res.writeHead(404); res.end(); }
    });
    await new Promise<void>((ready) => objectServer!.listen(0, "127.0.0.1", ready)); const address = objectServer.address(); assert(address && typeof address !== "string");
    process.env.DATABASE_URL = databaseUrl; process.env.R2_ACCOUNT_ID = "test"; process.env.R2_ACCESS_KEY_ID = "test"; process.env.R2_SECRET_ACCESS_KEY = "test"; process.env.R2_BUCKET_NAME = "test"; process.env.R2_ENDPOINT = `http://127.0.0.1:${address.port}`;
    const { saveStudyFile } = await import("../lib/study"); const { prisma } = await import("../lib/prisma");
    try {
      const r2 = await saveStudyFile(pdf, { examId: created.id, title: "R2 file", description: "", sortOrder: 0, fileName: "r2.pdf" });
      assert.equal(r2.storage, "R2"); assert.ok(r2.storageKey?.startsWith("study-materials/")); assert.deepEqual(objects.get(`/test/${r2.storageKey}`), pdf);
      const { getR2Config } = await import("../lib/r2"); const { GetObjectCommand } = await import("@aws-sdk/client-s3"); const config = getR2Config();
      const result = await config.client.send(new GetObjectCommand({ Bucket: config.bucket, Key: r2.storageKey!, Range: "bytes=2-6" })); assert.deepEqual(Buffer.from(await result.Body!.transformToByteArray()), pdf.subarray(2, 7));
    } finally { await prisma.$disconnect(); }
    console.log("Study integration passed: 13 calendar entries, safe repeated startup, admin rights, private notes/progress across sessions, uploads, local/R2 storage, ranges, validation, archive/restore and existing pages.");
  } finally {
    if (server && server.exitCode === null) { const exited = new Promise<void>((done) => server!.once("exit", () => done())); server.kill("SIGTERM"); await exited; }
    if (objectServer) await new Promise<void>((done) => objectServer!.close(() => done()));
    await db.$disconnect(); rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

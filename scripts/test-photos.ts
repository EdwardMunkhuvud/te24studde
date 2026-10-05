import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

// A disposable database and S3-compatible server; never uses the real bucket.
async function main() {
  const directory = await mkdtemp(join(tmpdir(), "studde-photo-test-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  process.env.R2_ACCOUNT_ID = "test";
  process.env.R2_ACCESS_KEY_ID = "test";
  process.env.R2_SECRET_ACCESS_KEY = "test";
  process.env.R2_BUCKET_NAME = "test";
  const objects = new Map<string, Buffer>();
  const server = createServer(async (request, response) => {
    const key = new URL(request.url!, "http://localhost").pathname;
    if (request.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      objects.set(key, Buffer.concat(chunks));
      response.writeHead(200, { ETag: '"test"' }); response.end();
    } else if (request.method === "DELETE") {
      objects.delete(key); response.writeHead(204); response.end();
    } else { response.writeHead(404); response.end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  process.env.R2_ENDPOINT = `http://127.0.0.1:${address.port}`;
  const { prisma } = await import("../lib/prisma");
  try {
    const source = await readFile("scripts/setup-db.ts", "utf8");
    const sql = source.match(/const sql = `([\s\S]*?)`;/)![1];
    const setup = () => {
      const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], { input: sql, encoding: "utf8", env: process.env });
      assert.equal(result.status, 0, result.stderr);
    };
    setup();
    const owner = await prisma.user.create({ data: { name: "Test Elev", username: "test.elev", passwordHash: "test" } });
    const admin = await prisma.user.create({ data: { name: "Test Admin", username: "test.admin", passwordHash: "test", role: "ADMIN" } });
    setup(); // Startup is idempotent and preserves existing users.
    assert.equal(await prisma.user.count(), 2);
    const { savePhoto, getPhotoPage, syncAttachments, attachmentIds, PhotoError } = await import("../lib/student-photos");
    const { sameOrigin, readPhotoBody } = await import("../lib/photo-request");
    const image = await sharp({ create: { width: 800, height: 1200, channels: 3, background: "#376784" } }).jpeg().toBuffer();
    const input = { fileName: "Klassresan åäö.jpg", caption: "Ett minne", scope: "GALLERY" as const, userId: owner.id, uploaderName: owner.name };
    const gallery = await savePhoto(image, input);
    const duplicateName = await savePhoto(image, input);
    assert.notEqual(gallery.storageKey, duplicateName.storageKey);
    assert(gallery.storageKey.startsWith("student-photos/gallery/"));
    assert.deepEqual(objects.get(`/test/${gallery.storageKey}`), image);
    const thumbnail = await sharp(objects.get(`/test/${gallery.thumbnailKey}`)!).metadata();
    assert.equal(thumbnail.height, 540); assert.equal(thumbnail.format, "webp");
    const count = objects.size;
    await assert.rejects(savePhoto(Buffer.from("not a picture"), input), (error: unknown) => error instanceof PhotoError && error.status === 415);
    assert.equal(objects.size, count);

    const attachment = await savePhoto(image, { ...input, scope: "ATTACHMENT", userId: admin.id, uploaderName: admin.name });
    assert(attachment.storageKey.startsWith("student-photos/attachments/"));
    assert.equal((await getPhotoPage()).total, 2); // Draft attachments never enter the album.
    const announcement = await prisma.announcement.create({ data: { title: "Test", body: "Testmeddelande", authorId: admin.id } });
    const poll = await prisma.poll.create({ data: { title: "Test", description: "Testomröstning", type: "CHOICE", authorId: admin.id } });
    await assert.rejects(prisma.$transaction((tx) => syncAttachments(tx, [attachment.id], owner.id, { announcementId: announcement.id })), PhotoError);
    await assert.rejects(prisma.$transaction(async (tx) => {
      await tx.announcement.update({ where: { id: announcement.id }, data: { title: "Must roll back" } });
      await syncAttachments(tx, [gallery.id], admin.id, { announcementId: announcement.id });
    }), PhotoError);
    assert.equal((await prisma.announcement.findUniqueOrThrow({ where: { id: announcement.id } })).title, "Test");
    await prisma.$transaction((tx) => syncAttachments(tx, [attachment.id], admin.id, { announcementId: announcement.id }));
    await prisma.$transaction((tx) => syncAttachments(tx, [attachment.id], admin.id, { announcementId: announcement.id })); // Retaining images in an edit.
    await assert.rejects(prisma.$transaction((tx) => syncAttachments(tx, [attachment.id], admin.id, { pollId: poll.id })), PhotoError);
    await prisma.$transaction((tx) => syncAttachments(tx, [], admin.id, { announcementId: announcement.id }));
    await prisma.$transaction((tx) => syncAttachments(tx, [attachment.id], admin.id, { pollId: poll.id }));
    await prisma.poll.delete({ where: { id: poll.id } });
    assert.equal((await prisma.studentPhoto.findUniqueOrThrow({ where: { id: attachment.id } })).pollId, null);
    assert.equal((await getPhotoPage()).total, 2);
    const form = new FormData();
    for (let index = 0; index < 5; index++) form.append("photoIds", String(index));
    assert.throws(() => attachmentIds(form), PhotoError);

    const timestamp = new Date("2026-01-01T12:00:00Z");
    for (let index = 0; index < 30; index++) await prisma.studentPhoto.create({ data: { ...input, storageKey: `pagination/${index}`, thumbnailKey: `pagination/thumb/${index}`, contentType: "image/jpeg", byteSize: 1, createdAt: timestamp } });
    const first = await getPhotoPage();
    assert.equal(first.photos.length, 24); assert(first.nextCursor);
    const second = await getPhotoPage(undefined, first.nextCursor);
    assert.equal(new Set([...first.photos, ...second.photos].map((photo) => photo.id)).size, 32);
    assert.equal(second.nextCursor, null);
    assert.equal((await getPhotoPage(admin.id)).total, 0);
    await assert.rejects(getPhotoPage(undefined, attachment.id), PhotoError);

    assert(sameOrigin(new Request("http://localhost/api", { headers: { origin: "https://studde.example", "x-forwarded-host": "studde.example" } })));
    assert(!sameOrigin(new Request("http://localhost/api", { headers: { origin: "https://other.example", host: "studde.example" } })));
    await assert.rejects(readPhotoBody(new Request("http://localhost/api", { method: "POST", body: new Uint8Array(10) }), 5), (error: unknown) => error instanceof PhotoError && error.status === 413);
    console.log("Photo checks passed: startup, storage, thumbnails, isolation, ownership, atomic edits, pagination and request limits.");
  } finally {
    await prisma.$disconnect();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

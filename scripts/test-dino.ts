// Run after npm run build. Uses an isolated temporary SQLite database only.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import type { DinoLeaderboard } from "../lib/dino-types";

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "studde-dino-"));
  const databaseUrl = `file:${join(directory, "test.db")}`;
  const secret = "isolated-dino-integration-test";
  const env = { ...process.env, DATABASE_URL: databaseUrl, SESSION_SECRET: secret };
  const setup = () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/setup-db.ts"], { env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  setup();
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  let server: ReturnType<typeof spawn> | undefined;
  try {
    const users = await Promise.all(["Anna", "Bo", "Cecilia"].map(name => db.user.create({ data: { name, username: `test-${name}`, passwordHash: "unused", role: name === "Cecilia" ? "ADMIN" : "STUDENT" } })));
    const contribution = await db.contribution.create({ data: { title: "Keep this", amount: 123, userId: users[0].id } });
    await db.setting.create({ data: { key: "sentinel", value: "untouched" } });
    setup(); // Repeated deployment must keep existing data.
    assert.equal((await db.contribution.findUniqueOrThrow({ where: { id: contribution.id } })).amount, 123);
    assert.equal((await db.setting.findUniqueOrThrow({ where: { key: "sentinel" } })).value, "untouched");

    server = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", "0"], { env, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    server.stdout?.on("data", chunk => { log += chunk.toString(); });
    server.stderr?.on("data", chunk => { log += chunk.toString(); });
    let base = "";
    for (let tries = 0; tries < 150; tries++) {
      base = log.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0] ?? "";
      if (base && log.includes("Ready")) break;
      if (server.exitCode !== null) throw new Error(log);
      await delay(100);
    }
    assert.ok(base && log.includes("Ready"), log);
    const cookies = await Promise.all(users.map(async user => `studde_session=${await new SignJWT({ userId: user.id, username: user.username, name: "STALE SESSION NAME", role: user.role }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(secret))}`));
    const request = (userIndex: number | null, body?: unknown, origin = base) => fetch(`${base}/api/dino`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(userIndex === null ? {} : { cookie: cookies[userIndex] }), origin, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal((await request(null)).status, 401);
    assert.equal((await request(null, { action: "start" })).status, 401);
    assert.equal((await request(0, { action: "start" }, "https://other.example")).status, 403);
    assert.equal((await request(0, null)).status, 400);
    assert.equal((await request(0, { nonsense: "x".repeat(2000) })).status, 413);
    const start = async (userIndex: number) => {
      // Make prior start old enough to avoid the real API's rapid-start limiter.
      await db.dinoRun.updateMany({ where: { userId: users[userIndex].id, completedAt: null }, data: { createdAt: new Date(Date.now() - 60000) } });
      const response = await request(userIndex, { action: "start", name: "FORGED NAME", userId: users[2].id });
      assert.equal(response.status, 201);
      const { runId } = await response.json();
      await db.dinoRun.update({ where: { id: runId }, data: { createdAt: new Date(Date.now() - 60000) } });
      return runId as string;
    };
    const runId = await start(0);
    assert.equal((await request(1, { action: "finish", runId, score: 123, durationMs: 10000 })).status, 404);
    for (const score of [-1, 2.5, 999999]) assert.equal((await request(0, { action: "finish", runId, score, durationMs: 10000 })).status, 400);
    assert.equal((await request(0, { action: "finish", runId, score: 10, durationMs: 1000000 })).status, 400);
    const finish = { action: "finish", runId, score: 123, durationMs: 10000, name: "FORGED NAME" };
    assert.equal((await request(0, finish)).status, 200);
    assert.equal((await request(0, finish)).status, 200);
    assert.equal((await request(0, { ...finish, score: 124 })).status, 409);
    assert.equal((await db.dinoRun.findUniqueOrThrow({ where: { id: runId } })).playerName, "Anna");
    // A finish racing another finish must still produce exactly one stored run.
    const concurrent = await start(1);
    const results = await Promise.all([request(1, { action: "finish", runId: concurrent, score: 100, durationMs: 10000 }), request(1, { action: "finish", runId: concurrent, score: 100, durationMs: 10000 })]);
    assert.ok(results.every(response => [200, 409].includes(response.status)));
    assert.equal(await db.dinoRun.count({ where: { id: concurrent, completedAt: { not: null } } }), 1);
    for (const [userIndex, score] of [[0, 150], [1, 110], [0, 130], [1, 180], [0, 10], [1, 120]]) {
      const id = await start(userIndex);
      assert.equal((await request(userIndex, { action: "finish", runId: id, score, durationMs: 10000 })).status, 200);
    }
    const board = await (await request(0)).json() as DinoLeaderboard;
    assert.equal(board.personalBest, 150);
    assert.deepEqual(board.topRuns.map(run => run.score), [180, 150, 130, 123, 120]);
    assert.deepEqual(board.players.map(player => [player.name, player.best?.score ?? null]), [["Bo", 180], ["Anna", 150], ["Cecilia", null]]);
    assert.equal(new Set(board.players.map(player => player.userId)).size, 3);
    assert.equal(await db.dinoRun.count({ where: { completedAt: { not: null } } }), 8);
    // Existing pages and the new tab remain accessible to the appropriate roles.
    for (const [index, path] of [[0, "/student"], [0, "/student?tab=dino"], [2, "/admin"], [2, "/admin?tab=dino"]] as const) {
      const response = await fetch(base + path, { headers: { cookie: cookies[index] } });
      assert.equal(response.status, 200, path);
      assert.ok((await response.text()).includes("Dino Run"), path);
    }
    assert.equal((await db.contribution.findUniqueOrThrow({ where: { id: contribution.id } })).amount, 123);
    console.log("Dino integration passed: auth, ownership, names, validation, replay, concurrent finish, persistent PB, top five and existing pages.");
  } finally {
    if (server && server.exitCode === null) {
      const exited = new Promise<void>(resolveExit => server!.once("exit", () => resolveExit()));
      server.kill("SIGTERM");
      await exited;
    }
    await db.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

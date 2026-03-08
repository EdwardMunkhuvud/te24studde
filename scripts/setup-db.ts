import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const schemaPath = "prisma/schema.prisma";
const sql = `
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'STUDENT',
  "targetAmount" INTEGER NOT NULL DEFAULT 1050,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "Contribution" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "note" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'MANUAL',
  "amount" INTEGER NOT NULL,
  "periodLabel" TEXT,
  "occurredAt" DATETIME,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Contribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE INDEX IF NOT EXISTS "Contribution_userId_occurredAt_sortOrder_idx" ON "Contribution"("userId", "occurredAt", "sortOrder");
`;

if (!existsSync(schemaPath)) {
  console.error(
    [
      `Hittade inte ${schemaPath}.`,
      "Om du deployar till Railway: montera inte volume ovanpa /app/prisma eftersom det doljer schema.prisma.",
      "Anvand i stallet en annan mount path, till exempel /app/data, och satt DATABASE_URL=file:../data/dev.db.",
    ].join("\n"),
  );
  process.exit(1);
}

const result = spawnSync(command, ["prisma", "db", "execute", "--stdin", "--schema", schemaPath], {
  encoding: "utf8",
  input: sql,
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

console.log(result.stdout.trim() || "Databasen ar redo.");

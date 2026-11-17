import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { CONTRIBUTION_TYPES } from "@/lib/constants";
import { MAX_CONTRIBUTION_AMOUNT, contributionDate, contributionNote, contributionTitle } from "@/lib/contributions";

const MAX_ROWS = 250;
const MAX_BYTES = 128 * 1024;

const importSchema = z.object({
  title: contributionTitle,
  date: contributionDate.optional(),
  entries: z.array(z.object({
    username: z.string().trim().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    amount: z.number().int().min(0).max(MAX_CONTRIBUTION_AMOUNT),
    note: contributionNote.optional(),
  }).strict().refine((entry) => entry.username || entry.name)).min(1).max(MAX_ROWS),
}).strict();

export class SalesImportError extends Error {}

function parseSalesFile(text: string) {
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
    throw new SalesImportError("JSON-filen får vara högst 128 KB.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new SalesImportError("Filen innehåller ogiltig JSON.");
  }

  const parsed = importSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const field = parsed.error.issues[0].path;
  if (field[0] === "title") throw new SalesImportError("Ange en rubrik med 2–60 tecken i title.");
  if (field[0] === "date") throw new SalesImportError("Ange datum i formatet ÅÅÅÅ-MM-DD.");
  if (field[0] === "entries" && typeof field[1] === "number") {
    const row = field[1] + 1;
    if (field[2] === "amount") throw new SalesImportError(`Rad ${row}: amount måste vara ett heltal från 0 till ${MAX_CONTRIBUTION_AMOUNT}.`);
    if (field[2] === "note") throw new SalesImportError(`Rad ${row}: note får innehålla högst 200 tecken.`);
    throw new SalesImportError(`Rad ${row}: kontrollera username, name, amount och eventuell note.`);
  }
  throw new SalesImportError(`Använd fälten title, valfritt date och entries med 1–${MAX_ROWS} rader.`);
}

function normalized(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function prepareSalesImport(db: Prisma.TransactionClient, text: string) {
  const file = parseSalesFile(text);
  const date = file.date || null;
  const occurredAt = date ? new Date(date) : null;
  const roundName = normalized(file.title);
  const receiptKey = `sales-import:${digest([roundName, date])}`;
  const receipt = await db.setting.findUnique({ where: { key: receiptKey }, select: { key: true } });
  if (receipt) throw new SalesImportError("Den här omgången har redan importerats. Ändra beloppen i respektive kontos historik.");

  const accounts = await db.user.findMany({ select: { id: true, name: true, username: true } });
  const seen = new Set<string>();
  const resolved = file.entries.map((entry, index) => {
    const row = index + 1;
    const matches = accounts.filter((account) => entry.username
      ? normalized(account.username) === normalized(entry.username)
      : normalized(account.name) === normalized(entry.name ?? ""));
    if (matches.length === 0) throw new SalesImportError(`Rad ${row}: inget konto matchar ${entry.username ?? entry.name}.`);
    if (matches.length > 1) throw new SalesImportError(`Rad ${row}: flera konton matchar. Ange användarnamn i username.`);

    const [account] = matches;
    if (entry.username && entry.name && normalized(account.name) !== normalized(entry.name)) {
      throw new SalesImportError(`Rad ${row}: namn och användarnamn tillhör inte samma konto.`);
    }
    if (seen.has(account.id)) throw new SalesImportError(`Rad ${row}: ${account.name} finns redan i filen.`);
    seen.add(account.id);
    return { ...account, amount: entry.amount, note: entry.note || null, row };
  });
  const rows = resolved.filter((entry) => entry.amount > 0);
  if (rows.length === 0) throw new SalesImportError("Filen behöver minst ett belopp över noll.");

  const sameDay = await db.contribution.findMany({
    where: { kind: CONTRIBUTION_TYPES.SALE, amount: { not: 0 }, occurredAt, userId: { in: rows.map((entry) => entry.id) } },
    select: { userId: true, title: true },
  });
  const existing = new Set(sameDay.filter((entry) => normalized(entry.title) === roundName).map((entry) => entry.userId));
  const duplicate = rows.find((entry) => existing.has(entry.id));
  if (duplicate) {
    throw new SalesImportError(`Rad ${duplicate.row}: ${duplicate.name} har redan en försäljning med samma rubrik och datum. Korrigera den i kontohistoriken eller lämna den raden utanför filen.`);
  }

  return {
    receiptKey,
    occurredAt,
    fingerprint: digest([file.title, date, resolved]),
    title: file.title,
    date,
    rows,
    skipped: resolved.length - rows.length,
    total: rows.reduce((sum, entry) => sum + entry.amount, 0),
  };
}

export async function saveSalesImport(db: Prisma.TransactionClient, text: string, fingerprint: string) {
  const batch = await prepareSalesImport(db, text);
  if (batch.fingerprint !== fingerprint) {
    throw new SalesImportError("Filen eller de matchade kontona har ändrats. Förhandsgranska igen.");
  }

  const maxOrders = await db.contribution.groupBy({
    by: ["userId"],
    where: { userId: { in: batch.rows.map((entry) => entry.id) } },
    _max: { sortOrder: true },
  });
  const sortOrders = new Map(maxOrders.map(({ userId, _max }) => [userId, _max.sortOrder ?? -1]));

  await db.setting.create({ data: { key: batch.receiptKey, value: batch.fingerprint } });
  await db.contribution.createMany({
    data: batch.rows.map((entry) => ({
      userId: entry.id,
      kind: CONTRIBUTION_TYPES.SALE,
      title: batch.title,
      occurredAt: batch.occurredAt,
      periodLabel: batch.date ? null : batch.title,
      amount: entry.amount,
      note: entry.note,
      sortOrder: (sortOrders.get(entry.id) ?? -1) + 1,
    })),
  });

  return { count: batch.rows.length, total: batch.total };
}

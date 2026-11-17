"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { prepareSalesImport, SalesImportError, saveSalesImport } from "@/lib/sales-import";

export async function previewSalesImportAction(text: string) {
  await requireRole(ROLES.ADMIN);
  if (typeof text !== "string") return { error: "Välj en JSON-fil." };

  try {
    const batch = await prepareSalesImport(prisma, text);
    return {
      preview: {
        title: batch.title,
        date: batch.date,
        fingerprint: batch.fingerprint,
        skipped: batch.skipped,
        total: batch.total,
        rows: batch.rows.map(({ username, name, amount, note }) => ({ username, name, amount, note })),
      },
    };
  } catch (error) {
    if (error instanceof SalesImportError) return { error: error.message };
    console.error("Could not preview sales import", error);
    return { error: "Förhandsgranskningen misslyckades. Försök igen." };
  }
}

export async function saveSalesImportAction(text: string, fingerprint: string) {
  await requireRole(ROLES.ADMIN);
  if (typeof text !== "string" || typeof fingerprint !== "string") {
    return { error: "Förhandsgranska filen först." };
  }

  try {
    const result = await prisma.$transaction((tx) => saveSalesImport(tx, text, fingerprint));
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/konton/[userId]", "page");
    revalidatePath("/student");
    return { result };
  } catch (error) {
    if (error instanceof SalesImportError) return { error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Den här omgången har redan importerats." };
    }
    console.error("Could not save sales import", error);
    return { error: "Importen kunde inte bekräftas. Förhandsgranska filen igen för att kontrollera status." };
  }
}

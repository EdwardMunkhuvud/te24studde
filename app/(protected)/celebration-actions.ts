"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth";
import {
  CELEBRATION_ADMIN_PATH, celebrationSurplus, getCelebrationParticipants,
  getCelebrationSettings, setCelebrationSettings,
} from "@/lib/celebration-survey";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function manageCelebrationSurvey(formData: FormData) {
  const session = await requireSession();
  if (session.role !== ROLES.ADMIN) redirect("/student");
  const intent = formData.get("intent");
  const rawSurplus = formData.get("surplus");
  const amount = celebrationSurplus.safeParse(
    typeof rawSurplus === "string" && /^\d+$/.test(rawSurplus) ? Number(rawSurplus) : undefined,
  );

  let result: "configured" | "opened" | "closed" | "invalid" | "retry" | "forbidden";
  try {
    result = await prisma.$transaction(async (db) => {
      const user = await db.user.findUnique({ where: { id: session.userId }, select: { role: true } });
      if (user?.role !== ROLES.ADMIN) return "forbidden";

      const settings = await getCelebrationSettings(db);
      if (intent === "save" && (!settings || settings.status === "draft") && amount.success) {
        await setCelebrationSettings(db, { status: "draft", surplus: amount.data });
        return "configured";
      }

      if (intent === "open" && settings && settings.status !== "open") {
        if (settings.status === "draft") {
          const participants = await getCelebrationParticipants(db);
          if (!participants.length) return "invalid";
          await db.celebrationResponse.createMany({
            data: participants.map((participant) => ({
              ...participant,
              accessToken: randomBytes(24).toString("base64url"),
            })),
          });
        }
        await setCelebrationSettings(db, { ...settings, status: "open" });
        return "opened";
      }

      if (intent === "close" && settings?.status === "open") {
        await setCelebrationSettings(db, { ...settings, status: "closed" });
        return "closed";
      }

      return "invalid";
    });
  } catch (error) {
    console.error("Could not update celebration survey", error instanceof Error ? error.name : "");
    result = "retry";
  }

  if (result === "forbidden") redirect("/");
  revalidatePath("/admin");
  redirect(CELEBRATION_ADMIN_PATH + "&survey=" + result);
}

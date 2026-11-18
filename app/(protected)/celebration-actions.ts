"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth";
import {
  celebrationAccount, celebrationChoice, celebrationIdea, celebrationPath, celebrationSurplus,
  getCelebrationParticipants, getCelebrationSettings, hasCelebrationFollowUp, setCelebrationSettings,
} from "@/lib/celebration-survey";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function saveCelebrationResponse(formData: FormData) {
  const session = await requireSession();
  const path = celebrationPath(session.role) + (session.role === ROLES.ADMIN ? "&view=own" : "");
  const idea = celebrationIdea.safeParse(formData.get("idea"));
  if (!idea.success) redirect(path + "&survey=invalid");

  let result: "saved" | "invalid" | "unavailable" | "retry";
  try {
    result = await prisma.$transaction(async (db) => {
      const user = await db.user.findUnique({ where: { id: session.userId }, select: { username: true, role: true } });
      const settings = await getCelebrationSettings(db);
      const row = await db.celebrationResponse.findUnique({ where: { userId: session.userId } });
      if (!user || !celebrationAccount(user.username, user.role) || settings?.status !== "open" || !row) {
        return "unavailable";
      }

      let payment = null;
      let attendance = null;
      if (hasCelebrationFollowUp(row.collected)) {
        const pay = celebrationChoice.safeParse(formData.get("payment"));
        const attend = celebrationChoice.safeParse(formData.get("attendance"));
        if (!pay.success || !attend.success) return "invalid";
        payment = pay.data;
        attendance = attend.data;
      }

      await db.celebrationResponse.update({
        where: { userId: session.userId },
        data: { payment, attendance, idea: idea.data || null, submittedAt: new Date() },
      });
      return "saved";
    });
  } catch (error) {
    console.error("Could not save celebration response", error instanceof Error ? error.name : "");
    result = "retry";
  }

  revalidatePath("/student");
  revalidatePath("/admin");
  redirect(path + "&survey=" + result);
}

export async function manageCelebrationSurvey(formData: FormData) {
  const session = await requireSession();
  const path = celebrationPath(ROLES.ADMIN);
  if (session.role !== ROLES.ADMIN) redirect(celebrationPath(session.role));
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
          await db.celebrationResponse.createMany({ data: participants });
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
  revalidatePath("/student");
  revalidatePath("/admin");
  redirect(path + "&survey=" + result);
}

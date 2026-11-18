"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  celebrationAccessToken,
  celebrationChoice,
  celebrationIdea,
  celebrationReplyPath,
  getCelebrationSettings,
  hasCelebrationFollowUp,
} from "@/lib/celebration-survey";
import { prisma } from "@/lib/prisma";

export async function saveCelebrationResponse(formData: FormData) {
  const token = celebrationAccessToken.safeParse(formData.get("accessToken"));
  if (!token.success) notFound();

  const path = celebrationReplyPath(token.data);
  const idea = celebrationIdea.safeParse(formData.get("idea"));
  if (!idea.success) redirect(path + "?survey=invalid");

  let result: "saved" | "invalid" | "unavailable" | "retry";
  try {
    result = await prisma.$transaction(async (db) => {
      const settings = await getCelebrationSettings(db);
      if (settings?.status !== "open") return "unavailable";

      const row = await db.celebrationResponse.findUnique({ where: { accessToken: token.data } });
      if (!row) return "unavailable";

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
        where: { userId: row.userId },
        data: { payment, attendance, idea: idea.data || null, submittedAt: new Date() },
      });
      return "saved";
    });
  } catch (error) {
    console.error("Could not save celebration response", error instanceof Error ? error.name : "");
    result = "retry";
  }

  revalidatePath(path);
  revalidatePath("/admin");
  redirect(path + "?survey=" + result);
}

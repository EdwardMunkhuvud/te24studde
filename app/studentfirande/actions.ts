"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  celebrationAccessToken,
  celebrationChoice,
  celebrationGroupPath,
  celebrationIdea,
  getCelebrationSettings,
  hasCelebrationFollowUp,
} from "@/lib/celebration-survey";
import { prisma } from "@/lib/prisma";

export async function saveCelebrationResponse(formData: FormData) {
  const group = celebrationAccessToken.safeParse(formData.get("groupToken"));
  const participant = celebrationAccessToken.safeParse(formData.get("participantToken"));
  if (!group.success || !participant.success) notFound();

  const path = celebrationGroupPath(group.data);
  const idea = celebrationIdea.safeParse(formData.get("idea"));
  const responsePath = `${path}?namn=${participant.data}`;
  if (!idea.success) redirect(responsePath + "&survey=invalid");

  let result: "saved" | "already-saved" | "invalid" | "unavailable" | "retry";

  try {
    result = await prisma.$transaction(async (db) => {
      const settings = await getCelebrationSettings(db);
      if (settings?.status !== "open" || settings.groupToken !== group.data) return "unavailable";

      const row = await db.celebrationResponse.findUnique({
        where: { accessToken: participant.data },
        select: { userId: true, collected: true, submittedAt: true },
      });
      if (!row) return "unavailable";
      if (row.submittedAt) return "already-saved";

      let payment = null;
      let attendance = null;
      if (hasCelebrationFollowUp(row.collected)) {
        const pay = celebrationChoice.safeParse(formData.get("payment"));
        const attend = celebrationChoice.safeParse(formData.get("attendance"));
        if (!pay.success || !attend.success) return "invalid";
        payment = pay.data;
        attendance = attend.data;
      }

      const saved = await db.celebrationResponse.updateMany({
        where: { userId: row.userId, submittedAt: null },
        data: { payment, attendance, idea: idea.data || null, submittedAt: new Date() },
      });
      return saved.count ? "saved" : "already-saved";
    });
  } catch (error) {
    console.error("Could not save celebration response", error instanceof Error ? error.name : "");
    result = "retry";
  }

  revalidatePath(path);
  revalidatePath("/admin");
  if (result === "saved") redirect(path + "?survey=saved");
  redirect(responsePath + "&survey=" + result);
}

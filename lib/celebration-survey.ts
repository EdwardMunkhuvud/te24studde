import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const CELEBRATION_GOAL = 1050;
export const CELEBRATION_FOLLOW_UP_LIMIT = 1000;
export const CELEBRATION_IDEA_LIMIT = 1500;
export const CELEBRATION_ADMIN_PATH = "/admin?tab=celebration";
const settingKey = "celebration-survey";
const classExpensesAccount = "klassens.kostnader";

export const celebrationChoices = {
  yes: "Ja",
  no: "Nej",
  unsure: "Jag är osäker",
} as const;

export const celebrationChoice = z.enum(["yes", "no", "unsure"]);
export const celebrationIdea = z.string().trim().max(CELEBRATION_IDEA_LIMIT);
export const celebrationAccessToken = z.string().regex(/^[a-zA-Z0-9_-]{32}$/);
export const celebrationSurplus = z.number().int().nonnegative().max(2_147_483_647);

const settingsSchema = z.object({
  status: z.enum(["draft", "open", "closed"]),
  surplus: celebrationSurplus,
  groupToken: celebrationAccessToken.optional(),
});

export type CelebrationSettings = z.infer<typeof settingsSchema>;

export function hasCelebrationFollowUp(collected: number) {
  return collected < CELEBRATION_FOLLOW_UP_LIMIT;
}

export function celebrationGroupPath(groupToken: string) {
  return `/studentfirande/${groupToken}`;
}

export async function getCelebrationSettings(db: Prisma.TransactionClient = prisma) {
  const setting = await db.setting.findUnique({ where: { key: settingKey } });
  return setting ? settingsSchema.parse(JSON.parse(setting.value)) : null;
}

export async function setCelebrationSettings(db: Prisma.TransactionClient, settings: CelebrationSettings) {
  const value = JSON.stringify(settings);
  await db.setting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value },
    update: { value },
  });
}

export async function getCelebrationParticipants(db: Prisma.TransactionClient = prisma) {
  const [users, amounts] = await Promise.all([
    db.user.findMany({
      where: { username: { not: classExpensesAccount }, role: { in: [ROLES.STUDENT, ROLES.ADMIN] } },
      select: { id: true },
    }),
    db.contribution.groupBy({ by: ["userId"], _sum: { amount: true } }),
  ]);
  const totals = new Map(amounts.map(({ userId, _sum }) => [userId, _sum.amount ?? 0]));
  return users.map(({ id }) => ({ userId: id, collected: totals.get(id) ?? 0 }));
}

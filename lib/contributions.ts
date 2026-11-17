import { z } from "zod";

import { CONTRIBUTION_TYPES } from "@/lib/constants";

export const MAX_CONTRIBUTION_AMOUNT = 2_147_483_647;
export const contributionTitle = z.string().trim().min(2).max(60);
export const contributionNote = z.string().trim().max(200);
export const contributionDate = z.string().trim().refine((value) => {
  if (!value) return true;

  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
});

export const contributionDetails = z.object({
  title: contributionTitle,
  amount: z.coerce.number().int().min(-2_147_483_648).max(MAX_CONTRIBUTION_AMOUNT),
  kind: z.enum([CONTRIBUTION_TYPES.SALE, CONTRIBUTION_TYPES.SWISH, CONTRIBUTION_TYPES.MANUAL]),
  occurredAt: contributionDate.optional(),
  note: contributionNote.optional(),
});

export function readContributionDetails(formData: FormData) {
  const amount = formData.get("amount");
  return contributionDetails.safeParse({
    title: formData.get("title"),
    amount: typeof amount === "string" && amount.trim() ? amount : undefined,
    kind: formData.get("kind"),
    occurredAt: formData.get("occurredAt") ?? undefined,
    note: formData.get("note") ?? undefined,
  });
}

export function contributionData(details: z.infer<typeof contributionDetails>) {
  return {
    title: details.title,
    amount: details.amount,
    kind: details.kind,
    note: details.note || null,
    occurredAt: details.occurredAt ? new Date(details.occurredAt) : null,
    periodLabel: details.occurredAt ? null : details.title,
  };
}

export function accountHistoryPath(userId: string) {
  return `/admin/konton/${encodeURIComponent(userId)}`;
}

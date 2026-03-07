import { format } from "date-fns";
import { sv } from "date-fns/locale";

import { CONTRIBUTION_TYPES, ContributionType } from "@/lib/constants";

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatAmountPlain(amount: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function slugifyName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .join(".");
}

export function buildUniqueUsername(base: string, existing: Set<string>) {
  if (!existing.has(base)) {
    existing.add(base);
    return base;
  }

  let suffix = 2;
  while (existing.has(`${base}.${suffix}`)) {
    suffix += 1;
  }

  const username = `${base}.${suffix}`;
  existing.add(username);
  return username;
}

export function contributionTypeLabel(type: ContributionType) {
  switch (type) {
    case CONTRIBUTION_TYPES.SALE:
      return "Försäljning";
    case CONTRIBUTION_TYPES.SWISH:
      return "Swish";
    case CONTRIBUTION_TYPES.MANUAL:
      return "Manuell justering";
    default:
      return "Post";
  }
}

export function formatTimelineLabel(input: { periodLabel: string | null; occurredAt: Date | null; title: string }) {
  if (input.periodLabel) {
    return input.periodLabel;
  }

  if (input.occurredAt) {
    return `${format(input.occurredAt, "d MMM", { locale: sv })} · ${input.title}`;
  }

  return input.title;
}

export function clampPercent(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

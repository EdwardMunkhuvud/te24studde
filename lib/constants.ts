export const ROLES = {
  ADMIN: "ADMIN",
  STUDENT: "STUDENT",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const CONTRIBUTION_TYPES = {
  SALE: "SALE",
  SWISH: "SWISH",
  MANUAL: "MANUAL",
} as const;

export type ContributionType = (typeof CONTRIBUTION_TYPES)[keyof typeof CONTRIBUTION_TYPES];

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

export const POLL_TYPES = {
  OPTION: "OPTION",
  SUGGESTION: "SUGGESTION",
} as const;

export type PollType = (typeof POLL_TYPES)[keyof typeof POLL_TYPES];

export const SEED_VERSION = "2026-03-08-easy-passwords-polls";

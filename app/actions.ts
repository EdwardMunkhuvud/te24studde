"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { clearSession, createSession, requireRole, requireSession } from "@/lib/auth";
import { CONTRIBUTION_TYPES, POLL_TYPES, ROLES, Role } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { buildUniqueUsername, slugifyName } from "@/lib/utils";

function buildRedirectUrl(basePath: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `${basePath}?${searchParams.toString()}`;
}

function redirectByRole(role: Role, status?: string, error?: string): never {
  const path = role === ROLES.ADMIN ? "/admin" : "/student";

  if (status) {
    redirect(buildRedirectUrl(path, { status }));
  }

  if (error) {
    redirect(buildRedirectUrl(path, { error }));
  }

  redirect(path);
}

function refreshApp() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/student");
}

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(buildRedirectUrl("/", { error: "missing-login" }));
  }

  const user = await prisma.user.findUnique({
    where: {
      username: parsed.data.username.toLowerCase(),
    },
  });

  if (!user) {
    redirect(buildRedirectUrl("/", { error: "invalid-login" }));
  }

  const passwordMatches = await compare(parsed.data.password, user.passwordHash);

  if (!passwordMatches) {
    redirect(buildRedirectUrl("/", { error: "invalid-login" }));
  }

  await createSession(user);
  redirectByRole(user.role as Role);
}

export async function logoutAction() {
  clearSession();
  redirect(buildRedirectUrl("/", { status: "logged-out" }));
}

const contributionSchema = z.object({
  userId: z.string().min(1),
  title: z.string().trim().min(2).max(60),
  amount: z.coerce.number().int().refine((value) => value !== 0),
  kind: z.enum([CONTRIBUTION_TYPES.SALE, CONTRIBUTION_TYPES.SWISH, CONTRIBUTION_TYPES.MANUAL]),
  occurredAt: z.string().trim().optional(),
  note: z.string().trim().max(200).optional(),
});

export async function createContributionAction(formData: FormData) {
  await requireRole(ROLES.ADMIN);

  const parsed = contributionSchema.safeParse({
    userId: formData.get("userId"),
    title: formData.get("title"),
    amount: formData.get("amount"),
    kind: formData.get("kind"),
    occurredAt: formData.get("occurredAt") ?? undefined,
    note: formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    redirect(buildRedirectUrl("/admin", { error: "invalid-transaction" }));
  }

  const user = await prisma.user.findUnique({
    where: {
      id: parsed.data.userId,
    },
    include: {
      contributions: {
        select: {
          sortOrder: true,
        },
      },
    },
  });

  if (!user) {
    redirect(buildRedirectUrl("/admin", { error: "unknown-student" }));
  }

  await prisma.contribution.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      amount: parsed.data.amount,
      kind: parsed.data.kind,
      note: parsed.data.note || null,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null,
      periodLabel: parsed.data.occurredAt ? null : parsed.data.title,
      sortOrder: user.contributions.length + 10,
    },
  });

  refreshApp();
  redirect(buildRedirectUrl("/admin", { status: "transaction-saved" }));
}

const studentSchema = z.object({
  name: z.string().trim().min(4).max(80),
  password: z.string().min(3).max(100),
  targetAmount: z.coerce.number().int().min(0).max(50000),
});

export async function createStudentAction(formData: FormData) {
  await requireRole(ROLES.ADMIN);

  const parsed = studentSchema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
    targetAmount: formData.get("targetAmount"),
  });

  if (!parsed.success) {
    redirect(buildRedirectUrl("/admin", { error: "invalid-student" }));
  }

  const existingUsernames = new Set(
    (
      await prisma.user.findMany({
        select: {
          username: true,
        },
      })
    ).map((user) => user.username),
  );

  const username = buildUniqueUsername(slugifyName(parsed.data.name), existingUsernames);

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      username,
      passwordHash: await hash(parsed.data.password, 10),
      targetAmount: parsed.data.targetAmount,
      role: ROLES.STUDENT,
    },
  });

  refreshApp();
  redirect(buildRedirectUrl("/admin", { status: "student-saved" }));
}

const passwordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(3).max(100),
});

export async function resetPasswordAction(formData: FormData) {
  await requireRole(ROLES.ADMIN);

  const parsed = passwordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(buildRedirectUrl("/admin", { error: "invalid-password" }));
  }

  await prisma.user.update({
    where: {
      id: parsed.data.userId,
    },
    data: {
      passwordHash: await hash(parsed.data.password, 10),
    },
  });

  refreshApp();
  redirect(buildRedirectUrl("/admin", { status: "password-reset" }));
}

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(100),
  body: z.string().trim().min(6).max(1200),
});

export async function createAnnouncementAction(formData: FormData) {
  const session = await requireRole(ROLES.ADMIN);
  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    redirect(buildRedirectUrl("/admin", { error: "invalid-announcement" }));
  }

  await prisma.announcement.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      authorId: session.userId,
    },
  });

  refreshApp();
  redirect(buildRedirectUrl("/admin", { status: "announcement-saved" }));
}

const updateAnnouncementSchema = announcementSchema.extend({
  announcementId: z.string().min(1),
});

export async function updateAnnouncementAction(formData: FormData) {
  await requireRole(ROLES.ADMIN);
  const parsed = updateAnnouncementSchema.safeParse({
    announcementId: formData.get("announcementId"),
    title: formData.get("title"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    redirect(buildRedirectUrl("/admin", { error: "invalid-announcement" }));
  }

  await prisma.announcement.update({
    where: {
      id: parsed.data.announcementId,
    },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      publishedAt: new Date(),
    },
  });

  refreshApp();
  redirect(buildRedirectUrl("/admin", { status: "announcement-updated" }));
}

const deleteAnnouncementSchema = z.object({
  announcementId: z.string().min(1),
});

export async function deleteAnnouncementAction(formData: FormData) {
  await requireRole(ROLES.ADMIN);
  const parsed = deleteAnnouncementSchema.safeParse({
    announcementId: formData.get("announcementId"),
  });

  if (!parsed.success) {
    redirect(buildRedirectUrl("/admin", { error: "invalid-announcement" }));
  }

  await prisma.announcement.delete({
    where: {
      id: parsed.data.announcementId,
    },
  });

  refreshApp();
  redirect(buildRedirectUrl("/admin", { status: "announcement-deleted" }));
}

const pollSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(6).max(1200),
  type: z.enum([POLL_TYPES.OPTION, POLL_TYPES.SUGGESTION]),
  optionsText: z.string().optional(),
});

function parsePollOptions(optionsText: string | undefined) {
  return (optionsText ?? "")
    .split(/\r?\n/)
    .map((option) => option.trim())
    .filter(Boolean)
    .filter((option, index, allOptions) => allOptions.indexOf(option) === index);
}

export async function createPollAction(formData: FormData) {
  const session = await requireRole(ROLES.ADMIN);
  const parsed = pollSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    optionsText: formData.get("optionsText") ?? undefined,
  });

  if (!parsed.success) {
    redirect(buildRedirectUrl("/admin", { error: "invalid-poll" }));
  }

  const options = parsePollOptions(parsed.data.optionsText);

  if (parsed.data.type === POLL_TYPES.OPTION && options.length < 2) {
    redirect(buildRedirectUrl("/admin", { error: "poll-options-required" }));
  }

  const poll = await prisma.poll.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      authorId: session.userId,
    },
  });

  if (parsed.data.type === POLL_TYPES.OPTION) {
    await prisma.pollOption.createMany({
      data: options.map((option, index) => ({
        pollId: poll.id,
        label: option,
        sortOrder: index,
      })),
    });
  }

  refreshApp();
  redirect(buildRedirectUrl("/admin", { status: "poll-saved" }));
}

const updatePollSchema = z.object({
  pollId: z.string().min(1),
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(6).max(1200),
  isOpen: z.enum(["true", "false"]),
});

export async function updatePollAction(formData: FormData) {
  await requireRole(ROLES.ADMIN);
  const parsed = updatePollSchema.safeParse({
    pollId: formData.get("pollId"),
    title: formData.get("title"),
    description: formData.get("description"),
    isOpen: formData.get("isOpen"),
  });

  if (!parsed.success) {
    redirect(buildRedirectUrl("/admin", { error: "invalid-poll" }));
  }

  await prisma.poll.update({
    where: {
      id: parsed.data.pollId,
    },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      isOpen: parsed.data.isOpen === "true",
    },
  });

  refreshApp();
  redirect(buildRedirectUrl("/admin", { status: "poll-updated" }));
}

const deletePollSchema = z.object({
  pollId: z.string().min(1),
});

export async function deletePollAction(formData: FormData) {
  await requireRole(ROLES.ADMIN);
  const parsed = deletePollSchema.safeParse({
    pollId: formData.get("pollId"),
  });

  if (!parsed.success) {
    redirect(buildRedirectUrl("/admin", { error: "invalid-poll" }));
  }

  await prisma.poll.delete({
    where: {
      id: parsed.data.pollId,
    },
  });

  refreshApp();
  redirect(buildRedirectUrl("/admin", { status: "poll-deleted" }));
}

const optionVoteSchema = z.object({
  pollId: z.string().min(1),
  optionId: z.string().min(1),
});

export async function submitOptionVoteAction(formData: FormData) {
  const session = await requireSession();
  const parsed = optionVoteSchema.safeParse({
    pollId: formData.get("pollId"),
    optionId: formData.get("optionId"),
  });

  if (!parsed.success) {
    redirectByRole(session.role, undefined, "invalid-vote");
  }

  const option = await prisma.pollOption.findUnique({
    where: {
      id: parsed.data.optionId,
    },
    include: {
      poll: true,
    },
  });

  if (!option || option.pollId !== parsed.data.pollId || !option.poll.isOpen) {
    redirectByRole(session.role, undefined, "invalid-vote");
  }

  await prisma.pollResponse.upsert({
    where: {
      pollId_userId: {
        pollId: parsed.data.pollId,
        userId: session.userId,
      },
    },
    update: {
      optionId: parsed.data.optionId,
      suggestionText: null,
    },
    create: {
      pollId: parsed.data.pollId,
      userId: session.userId,
      optionId: parsed.data.optionId,
      suggestionText: null,
    },
  });

  refreshApp();
  redirectByRole(session.role, "vote-saved");
}

const suggestionVoteSchema = z.object({
  pollId: z.string().min(1),
  suggestionText: z.string().trim().min(2).max(250),
});

export async function submitSuggestionVoteAction(formData: FormData) {
  const session = await requireSession();
  const parsed = suggestionVoteSchema.safeParse({
    pollId: formData.get("pollId"),
    suggestionText: formData.get("suggestionText"),
  });

  if (!parsed.success) {
    redirectByRole(session.role, undefined, "invalid-vote");
  }

  const poll = await prisma.poll.findUnique({
    where: {
      id: parsed.data.pollId,
    },
  });

  if (!poll || !poll.isOpen || poll.type !== POLL_TYPES.SUGGESTION) {
    redirectByRole(session.role, undefined, "invalid-vote");
  }

  await prisma.pollResponse.upsert({
    where: {
      pollId_userId: {
        pollId: parsed.data.pollId,
        userId: session.userId,
      },
    },
    update: {
      suggestionText: parsed.data.suggestionText,
      optionId: null,
    },
    create: {
      pollId: parsed.data.pollId,
      userId: session.userId,
      suggestionText: parsed.data.suggestionText,
      optionId: null,
    },
  });

  refreshApp();
  redirectByRole(session.role, "vote-saved");
}

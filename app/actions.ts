"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { clearSession, createSession, requireRole } from "@/lib/auth";
import { CONTRIBUTION_TYPES, ROLES, Role } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { buildUniqueUsername, slugifyName } from "@/lib/utils";

function buildRedirectUrl(basePath: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `${basePath}?${searchParams.toString()}`;
}

function redirectByRole(role: Role) {
  redirect(role === ROLES.ADMIN ? "/admin" : "/student");
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

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/student");
  redirect(buildRedirectUrl("/admin", { status: "transaction-saved" }));
}

const studentSchema = z.object({
  name: z.string().trim().min(4).max(80),
  password: z.string().min(6).max(100),
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

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(buildRedirectUrl("/admin", { status: "student-saved" }));
}

const passwordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(6).max(100),
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

  revalidatePath("/admin");
  revalidatePath("/student");
  redirect(buildRedirectUrl("/admin", { status: "password-reset" }));
}

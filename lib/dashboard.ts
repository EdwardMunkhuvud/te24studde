import { Contribution, User } from "@prisma/client";

import { ContributionType, Role } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { clampPercent, contributionTypeLabel, formatTimelineLabel } from "@/lib/utils";

type UserWithContributions = User & {
  contributions: Contribution[];
};

export type StudentRow = {
  id: string;
  name: string;
  username: string;
  role: Role;
  totalAmount: number;
  targetAmount: number;
  remainingAmount: number;
  progressPercent: number;
  contributionCount: number;
};

export type HistoryPoint = {
  id: string;
  label: string;
  amount: number;
  total: number;
  kindLabel: string;
  note: string | null;
};

function sortContributions(contributions: Contribution[]) {
  return [...contributions].sort((left, right) => {
    if (left.occurredAt && right.occurredAt) {
      const dateDifference = left.occurredAt.getTime() - right.occurredAt.getTime();
      if (dateDifference !== 0) {
        return dateDifference;
      }
    }

    if (left.occurredAt && !right.occurredAt) {
      return 1;
    }

    if (!left.occurredAt && right.occurredAt) {
      return -1;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

function summarizeUsers(users: UserWithContributions[]) {
  return users
    .map((user) => {
      const totalAmount = user.contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
      const remainingAmount = user.targetAmount - totalAmount;

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role as Role,
        totalAmount,
        targetAmount: user.targetAmount,
        remainingAmount,
        progressPercent: clampPercent((totalAmount / user.targetAmount) * 100),
        contributionCount: user.contributions.length,
      } satisfies StudentRow;
    })
    .sort((left, right) => {
      if (right.totalAmount !== left.totalAmount) {
        return right.totalAmount - left.totalAmount;
      }

      return left.name.localeCompare(right.name, "sv");
    });
}

function buildHistory(contributions: Contribution[]) {
  let runningTotal = 0;

  return sortContributions(contributions).map((contribution) => {
    runningTotal += contribution.amount;

    return {
      id: contribution.id,
      label: formatTimelineLabel(contribution),
      amount: contribution.amount,
      total: runningTotal,
      kindLabel: contributionTypeLabel(contribution.kind as ContributionType),
      note: contribution.note,
    } satisfies HistoryPoint;
  });
}

export async function getPublicStats() {
  const users = await prisma.user.findMany({
    include: {
      contributions: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const rows = summarizeUsers(users);
  const classTotal = rows.reduce((sum, row) => sum + row.totalAmount, 0);
  const classTarget = rows.reduce((sum, row) => sum + row.targetAmount, 0);

  return {
    studentCount: rows.length,
    classTotal,
    classTarget,
    leadingStudent: rows[0] ?? null,
  };
}

export async function getStudentDashboard(userId: string) {
  const users = await prisma.user.findMany({
    include: {
      contributions: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const rows = summarizeUsers(users);
  const currentStudent = users.find((user) => user.id === userId);

  if (!currentStudent) {
    throw new Error("Kunde inte hitta eleven i databasen.");
  }

  const summary = rows.find((row) => row.id === userId);

  if (!summary) {
    throw new Error("Kunde inte sammanfatta elevens saldo.");
  }

  const classTotal = rows.reduce((sum, row) => sum + row.totalAmount, 0);
  const classTarget = rows.reduce((sum, row) => sum + row.targetAmount, 0);
  const averageAmount = rows.length > 0 ? Math.round(classTotal / rows.length) : 0;
  const rank = rows.findIndex((row) => row.id === userId) + 1;

  return {
    currentStudent: {
      ...summary,
      history: buildHistory(currentStudent.contributions),
    },
    rank,
    averageAmount,
    classTotal,
    classTarget,
    classRows: rows,
  };
}

export async function getAdminDashboard(adminId: string) {
  const users = await prisma.user.findMany({
    include: {
      contributions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const rows = summarizeUsers(users);
  const classTotal = rows.reduce((sum, row) => sum + row.totalAmount, 0);
  const classTarget = rows.reduce((sum, row) => sum + row.targetAmount, 0);
  const averageAmount = rows.length > 0 ? Math.round(classTotal / rows.length) : 0;
  const contributionCount = users.reduce((sum, user) => sum + user.contributions.length, 0);
  const recentContributions = users
    .flatMap((user) =>
      user.contributions.map((contribution) => ({
        id: contribution.id,
        userName: user.name,
        title: contribution.title,
        amount: contribution.amount,
        kindLabel: contributionTypeLabel(contribution.kind as ContributionType),
        note: contribution.note,
      })),
    )
    .slice(0, 8);

  const adminSummary = rows.find((row) => row.id === adminId) ?? null;
  const adminUser = users.find((user) => user.id === adminId) ?? null;

  return {
    classTotal,
    classTarget,
    averageAmount,
    contributionCount,
    rows,
    userOptions: rows.map((row) => ({
      id: row.id,
      name: row.name,
      username: row.username,
      role: row.role,
    })),
    recentContributions,
    adminSummary:
      adminSummary && adminUser
        ? {
            ...adminSummary,
            history: buildHistory(adminUser.contributions),
          }
        : null,
  };
}

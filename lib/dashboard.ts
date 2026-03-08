import {
  Announcement,
  Contribution,
  Poll,
  PollOption,
  PollResponse,
  User,
} from "@prisma/client";

import { ContributionType, PollType, Role } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { clampPercent, contributionTypeLabel, formatTimelineLabel } from "@/lib/utils";

type UserWithContributions = User & {
  contributions: Contribution[];
};

type AnnouncementWithAuthor = Announcement & {
  author: Pick<User, "id" | "name">;
};

type PollWithRelations = Poll & {
  author: Pick<User, "id" | "name">;
  options: PollOption[];
  responses: Array<
    PollResponse & {
      user: Pick<User, "id" | "name" | "username">;
      option: Pick<PollOption, "id" | "label"> | null;
    }
  >;
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

export type AnnouncementCard = {
  id: string;
  title: string;
  body: string;
  publishedAt: Date;
  authorName: string;
};

export type PollCard = {
  id: string;
  title: string;
  description: string;
  type: PollType;
  isOpen: boolean;
  createdAt: Date;
  authorName: string;
  totalResponses: number;
  options: Array<{
    id: string;
    label: string;
    voteCount: number;
    percentage: number;
    voterNames: string[];
    selectedByCurrentUser: boolean;
  }>;
  suggestions: Array<{
    id: string;
    text: string;
    createdAt: Date;
    authorName: string | null;
    isOwn: boolean;
  }>;
  currentUserResponse: {
    optionId: string | null;
    suggestionText: string | null;
  } | null;
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

function buildAnnouncements(announcements: AnnouncementWithAuthor[]) {
  return announcements.map((announcement) => ({
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    publishedAt: announcement.publishedAt,
    authorName: announcement.author.name,
  }));
}

function buildPollCards(
  polls: PollWithRelations[],
  currentUserId?: string,
  includeIdentity = false,
) {
  return polls.map((poll) => {
    const currentUserResponse =
      poll.responses.find((response) => response.userId === currentUserId) ?? null;

    const options = poll.options
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((option) => {
        const matchingResponses = poll.responses.filter((response) => response.optionId === option.id);
        const voteCount = matchingResponses.length;

        return {
          id: option.id,
          label: option.label,
          voteCount,
          percentage: poll.responses.length > 0 ? Math.round((voteCount / poll.responses.length) * 100) : 0,
          voterNames: includeIdentity ? matchingResponses.map((response) => response.user.name) : [],
          selectedByCurrentUser: currentUserResponse?.optionId === option.id,
        };
      });

    const suggestions = poll.responses
      .filter((response) => response.suggestionText)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((response) => ({
        id: response.id,
        text: response.suggestionText ?? "",
        createdAt: response.createdAt,
        authorName: includeIdentity ? response.user.name : null,
        isOwn: response.userId === currentUserId,
      }));

    return {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      type: poll.type as PollType,
      isOpen: poll.isOpen,
      createdAt: poll.createdAt,
      authorName: poll.author.name,
      totalResponses: poll.responses.length,
      options,
      suggestions,
      currentUserResponse: currentUserResponse
        ? {
            optionId: currentUserResponse.optionId,
            suggestionText: currentUserResponse.suggestionText,
          }
        : null,
    } satisfies PollCard;
  });
}

async function getCommunityContent(currentUserId?: string, includeIdentity = false) {
  const [announcements, polls] = await Promise.all([
    prisma.announcement.findMany({
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.poll.findMany({
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        options: true,
        responses: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
            option: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  return {
    announcements: buildAnnouncements(announcements),
    polls: buildPollCards(polls, currentUserId, includeIdentity),
  };
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
  const community = await getCommunityContent();

  return {
    studentCount: rows.length,
    classTotal,
    classTarget,
    leadingStudent: rows[0] ?? null,
    announcements: community.announcements,
    polls: community.polls,
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
  const community = await getCommunityContent(userId, false);

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
    announcements: community.announcements,
    polls: community.polls,
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
  const community = await getCommunityContent(adminId, true);

  return {
    classTotal,
    classTarget,
    averageAmount,
    contributionCount,
    rows,
    announcements: community.announcements,
    polls: community.polls,
    openPollCount: community.polls.filter((poll) => poll.isOpen).length,
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

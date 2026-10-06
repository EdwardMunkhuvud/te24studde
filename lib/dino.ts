import { prisma } from "@/lib/prisma";
import type { DinoLeaderboard, DinoScore } from "@/lib/dino-types";

function scoreItem(run: { id: string; userId: string; playerName: string; score: number | null; completedAt: Date | null }): DinoScore {
  return { id: run.id, userId: run.userId, name: run.playerName, score: run.score!, completedAt: run.completedAt!.toISOString() };
}

export async function getDinoLeaderboard(userId: string): Promise<DinoLeaderboard> {
  const completed = { completedAt: { not: null }, score: { not: null } };
  const orderBy = [{ score: "desc" as const }, { completedAt: "asc" as const }, { id: "asc" as const }];
  const [users, runs] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, dinoRuns: { where: completed, orderBy, take: 1 } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.dinoRun.findMany({ where: completed, orderBy, take: 5 }),
  ]);
  const players = users.map(user => ({ userId: user.id, name: user.name, best: user.dinoRuns[0] ? scoreItem(user.dinoRuns[0]) : null }));
  players.sort((a, b) => (b.best?.score ?? -1) - (a.best?.score ?? -1) || a.name.localeCompare(b.name, "sv"));
  return { players, topRuns: runs.map(scoreItem), personalBest: players.find(player => player.userId === userId)?.best?.score ?? 0 };
}

// Chromium caps speed at 13 px/frame (60 fps), with a score coefficient of .025.
// This bounds submitted scores against both active play time and server time.
export function plausibleDinoResult(score: number, durationMs: number, elapsedMs: number) {
  return Number.isSafeInteger(score) && score >= 0 && score <= 1_000_000
    && Number.isSafeInteger(durationMs) && durationMs >= 0 && durationMs <= 21_600_000
    && durationMs <= elapsedMs + 2000
    && score <= Math.ceil(Math.min(durationMs, elapsedMs + 2000) * 0.0195) + 3;
}

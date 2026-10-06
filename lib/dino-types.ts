export type DinoScore = {
  id: string;
  userId: string;
  name: string;
  score: number;
  completedAt: string;
};

export type DinoLeaderboard = {
  personalBest: number;
  players: { userId: string; name: string; best: DinoScore | null }[];
  topRuns: DinoScore[];
};

export type DinoResult = { runId: string; score: number; durationMs: number };

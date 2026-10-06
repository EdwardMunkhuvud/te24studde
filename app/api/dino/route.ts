import { getSession } from "@/lib/auth";
import { getDinoLeaderboard, plausibleDinoResult } from "@/lib/dino";
import { sameOrigin } from "@/lib/photo-request";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function unavailable(error: unknown) {
  console.error("Dino:", error);
  return Response.json({ error: "Topplistan kunde inte nås. Försök igen." }, { status: 503 });
}

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Logga in för att se topplistan." }, { status: 401 });
  try {
    return Response.json(await getDinoLeaderboard(session.userId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Logga in igen för att spara poängen." }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Starta spelet från Studde." }, { status: 403 });
  // Bound the stream as well as Content-Length, which may be absent or incorrect.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Ogiltig runda." }, { status: 400 });
  let text = "";
  let size = 0;
  try {
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1024) {
        await reader.cancel();
        return Response.json({ error: "Ogiltig runda." }, { status: 413 });
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  let body;
  try { body = JSON.parse(text); } catch { return Response.json({ error: "Ogiltig runda." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Ogiltig runda." }, { status: 400 });
  try {
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
    if (!user) return Response.json({ error: "Kontot finns inte längre." }, { status: 401 });
    if (body.action === "start") {
      const latest = await prisma.dinoRun.findFirst({ where: { userId: session.userId }, orderBy: { createdAt: "desc" } });
      if (latest && Date.now() - latest.createdAt.getTime() < 750) return Response.json({ error: "Vänta ett ögonblick och starta igen." }, { status: 429 });
      await prisma.dinoRun.deleteMany({ where: { userId: session.userId, completedAt: null, createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
      const run = await prisma.dinoRun.create({ data: { userId: session.userId, playerName: user.name } });
      return Response.json({ runId: run.id }, { status: 201 });
    }
    if (body.action !== "finish" || typeof body.runId !== "string" || typeof body.score !== "number" || typeof body.durationMs !== "number") {
      return Response.json({ error: "Ogiltig runda." }, { status: 400 });
    }
    const run = await prisma.dinoRun.findFirst({ where: { id: body.runId, userId: session.userId } });
    if (!run) return Response.json({ error: "Rundan hittades inte för ditt konto." }, { status: 404 });
    if (run.completedAt) {
      if (run.score !== body.score || run.durationMs !== body.durationMs) return Response.json({ error: "Rundan är redan sparad." }, { status: 409 });
      return Response.json({ saved: true }); // Retrying after a lost response is safe.
    }
    if (!plausibleDinoResult(body.score, body.durationMs, Date.now() - run.createdAt.getTime())) {
      return Response.json({ error: "Poängen stämmer inte med rundans speltid." }, { status: 400 });
    }
    const saved = await prisma.dinoRun.updateMany({
      where: { id: run.id, userId: session.userId, completedAt: null },
      data: { score: body.score, durationMs: body.durationMs, playerName: user.name, completedAt: new Date() },
    });
    if (!saved.count) return Response.json({ error: "Rundan håller på att sparas. Försök igen." }, { status: 409 });
    return Response.json({ saved: true });
  } catch (error) { return unavailable(error); }
}

import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sameOrigin } from "@/lib/photo-request";
import { StudyError } from "@/lib/study";

export async function studyUser(request: Request, mutation = false, admin = false) {
  const session = await getSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true } }) : null;
  if (!user) throw new StudyError("Logga in igen för att använda studiehubben.", 401);
  if (mutation && !sameOrigin(request)) throw new StudyError("Ändringen måste göras från Studde.", 403);
  if (admin && user.role !== "ADMIN") throw new StudyError("Bara admin kan ändra prov och material.", 403);
  return user;
}
export async function readStudyBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new StudyError("Inget innehåll skickades.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new StudyError("Innehållet är för stort.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export function studyErrorResponse(error: unknown) {
  if (error instanceof StudyError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof URIError) return Response.json({ error: "Kontrollera fälten och försök igen." }, { status: 400 });
  console.error("Studiehubb:", error);
  return Response.json({ error: "Det gick inte att spara eller hämta innehållet. Försök igen." }, { status: 503 });
}

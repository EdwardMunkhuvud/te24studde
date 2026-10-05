import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2Object, isR2Configured } from "@/lib/r2";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const photo = await prisma.studentPhoto.findUnique({ where: { id: params.id } });
  if (!photo) return new Response("Bilden finns inte längre.", { status: 404 });
  const publishedAttachment = photo.scope === "ATTACHMENT" && Boolean(photo.announcementId || photo.pollId);
  if (!publishedAttachment) {
    const session = await getSession();
    if (!session) return new Response("Logga in för att se bilden.", { status: 401 });
    if (photo.scope !== "GALLERY" && photo.userId !== session.userId && session.role !== "ADMIN") return new Response("Bilden är inte tillgänglig.", { status: 403 });
  }
  if (!isR2Configured()) return new Response("Bildlagringen är inte ansluten.", { status: 503 });
  const query = new URL(request.url).searchParams;
  const thumbnail = query.get("size") === "thumbnail";
  try {
    const object = await getR2Object(thumbnail ? photo.thumbnailKey : photo.storageKey);
    if (!object.Body) return new Response("Bilden saknas.", { status: 404 });
    return new Response(object.Body.transformToWebStream(), { headers: {
      "Content-Type": thumbnail ? "image/webp" : photo.contentType,
      "Content-Disposition": `${query.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(photo.fileName)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      ...(object.ContentLength ? { "Content-Length": String(object.ContentLength) } : {}),
    } });
  } catch { return new Response("Bilden kunde inte hämtas. Försök igen.", { status: 503 }); }
}

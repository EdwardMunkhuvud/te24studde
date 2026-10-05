import { revalidatePath } from "next/cache";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2Config, isR2Configured } from "@/lib/r2";
import { sameOrigin, photoErrorResponse } from "@/lib/photo-request";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Logga in igen." }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Ogiltig begäran." }, { status: 403 });
  const photo = await prisma.studentPhoto.findUnique({ where: { id: params.id } });
  if (!photo) return Response.json({ error: "Bilden finns inte längre." }, { status: 404 });
  if (photo.scope !== "GALLERY" || (photo.userId !== session.userId && session.role !== "ADMIN")) {
    return Response.json({ error: "Du kan bara ta bort dina egna studentbilder." }, { status: 403 });
  }
  if (!isR2Configured()) return Response.json({ error: "Bildlagringen är inte ansluten." }, { status: 503 });
  try {
    // Remove from the album first; a storage outage must not leave a broken visible card.
    await prisma.studentPhoto.delete({ where: { id: photo.id } });
    const { bucket, client } = getR2Config();
    const cleanup = await Promise.allSettled([photo.storageKey, photo.thumbnailKey].map((Key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key }))));
    if (cleanup.some((result) => result.status === "rejected")) console.error("Kunde inte rensa R2-objekt för borttagen bild:", photo.id);
    revalidatePath("/admin"); revalidatePath("/student");
    return Response.json({ ok: true });
  } catch (error) { return photoErrorResponse(error); }
}

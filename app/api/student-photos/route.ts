import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { isR2Configured } from "@/lib/r2";
import { MAX_PHOTO_BYTES } from "@/lib/photo-types";
import { getPhotoPage, photoItem, savePhoto, PhotoError } from "@/lib/student-photos";
import { photoErrorResponse, readPhotoBody, sameOrigin } from "@/lib/photo-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Logga in för att se studentbilderna." }, { status: 401 });
  try {
    const query = new URL(request.url).searchParams;
    return Response.json(await getPhotoPage(query.get("mine") === "1" ? session.userId : undefined, query.get("cursor") ?? undefined));
  } catch (error) { return photoErrorResponse(error); }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Logga in igen för att ladda upp." }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Uppladdningen måste göras från Studde." }, { status: 403 });
  if (!isR2Configured()) return Response.json({ error: "Bildlagringen är inte ansluten ännu. Kontakta Edvin." }, { status: 503 });
  try {
    const scope = request.headers.get("x-photo-scope") ?? "GALLERY";
    if (scope !== "GALLERY" && scope !== "ATTACHMENT") throw new PhotoError("Ogiltig bildsamling.");
    if (scope === "ATTACHMENT" && session.role !== "ADMIN") throw new PhotoError("Endast admin kan lägga till bilder i inlägg.", 403);
    const decode = (value: string) => { try { return decodeURIComponent(value); } catch { throw new PhotoError("Filnamnet eller bildtexten är ogiltig."); } };
    const fileName = decode(request.headers.get("x-file-name") ?? "bild").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200);
    const caption = decode(request.headers.get("x-photo-caption") ?? "").trim();
    if (caption.length > 200) throw new PhotoError("Bildtexten får vara högst 200 tecken.");
    const bytes = await readPhotoBody(request, MAX_PHOTO_BYTES);
    const photo = await savePhoto(bytes, { fileName, caption, scope, userId: session.userId, uploaderName: session.name });
    revalidatePath("/student"); revalidatePath("/admin");
    return Response.json({ photo: photoItem(photo) }, { status: 201 });
  } catch (error) { return photoErrorResponse(error); }
}

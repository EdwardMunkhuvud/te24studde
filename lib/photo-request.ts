import { PhotoError } from "@/lib/student-photos";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    // Railway terminates HTTPS before forwarding the request to Next.
    const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim()
      || request.headers.get("host") || new URL(request.url).host;
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.host === host;
  } catch { return false; }
}

export async function readPhotoBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new PhotoError("Välj en bild först.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new PhotoError("Bilden är större än 25 MB.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export function photoErrorResponse(error: unknown) {
  if (error instanceof PhotoError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Studentbilder:", error);
  return Response.json({ error: "Det gick inte att nå bildlagringen. Försök igen om en stund." }, { status: 503 });
}

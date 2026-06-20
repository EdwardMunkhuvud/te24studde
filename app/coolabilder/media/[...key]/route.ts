import { getR2Object, isR2Configured } from "../../../../lib/r2";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { key: string[] } }) {
  if (!isR2Configured()) {
    return new Response("R2 är inte konfigurerat.", { status: 404 });
  }

  const key = params.key.map(decodeURIComponent).join("/");

  if (!key.startsWith("media/")) {
    return new Response("Ogiltig mediasökväg.", { status: 400 });
  }

  const object = await getR2Object(key);

  if (!object.Body) {
    return new Response("Filen hittades inte.", { status: 404 });
  }

  return new Response(object.Body.transformToWebStream(), {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(key.split("/").pop() ?? "media")}`,
      "Content-Length": String(object.ContentLength ?? ""),
      "Content-Type": object.ContentType ?? "application/octet-stream",
    },
  });
}

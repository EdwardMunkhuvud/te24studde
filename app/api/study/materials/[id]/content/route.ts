import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { getR2Config, isR2Configured } from "@/lib/r2";
import { localStudyPath, StudyError } from "@/lib/study";
import { studyErrorResponse, studyUser } from "@/lib/study-request";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await studyUser(request);
    const material = await prisma.studyMaterial.findUnique({ where: { id: params.id }, include: { exam: true } });
    if (!material?.storageKey || material.kind === "LINK" || ((material.archived || material.exam.archived) && user.role !== "ADMIN")) throw new StudyError("Materialet hittades inte.", 404);
    const range = request.headers.get("range");
    let start = 0, end = material.byteSize - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${material.byteSize}` } });
      start = match[1] ? Number(match[1]) : Math.max(0, material.byteSize - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= material.byteSize || (!match[1] && Number(match[2]) === 0)) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${material.byteSize}` } });
    }
    let stream: ReadableStream;
    if (material.storage === "R2") {
      if (!isR2Configured()) throw new StudyError("Fillagringen är inte tillgänglig.", 503);
      const { client, bucket } = getR2Config();
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: material.storageKey, ...(range ? { Range: `bytes=${start}-${end}` } : {}) }));
      if (!object.Body) throw new StudyError("Filen saknas.", 404);
      stream = object.Body.transformToWebStream();
    } else {
      const path = localStudyPath(material.storageKey);
      await stat(path);
      stream = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream;
    }
    return new Response(stream, { status: range ? 206 : 200, headers: {
      "Content-Type": material.contentType, "Content-Length": String(end - start + 1),
      "Content-Disposition": `${new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(material.fileName)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes",
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${material.byteSize}` } : {}),
    } });
  } catch (error) { return studyErrorResponse(error); }
}

import { timingSafeEqual } from "crypto";

import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { getR2Config, isR2Configured } from "../../../lib/r2";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return authorize(request) ?? Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const unauthorized = authorize(request);

  if (unauthorized) {
    return unauthorized;
  }

  const encodedKey = request.headers.get("x-media-key") ?? "";
  let key = "";

  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    return Response.json({ error: "Ogiltig filnyckel." }, { status: 400 });
  }

  if (!/^media\/20\d{2}-[01]\d-[0-3]\d\/\d+-.+$/.test(key)) {
    return Response.json({ error: "Ogiltig filnyckel." }, { status: 400 });
  }

  const { bucket, client } = getR2Config();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

  return Response.json({ ok: true });
}

function authorize(request: Request) {
  if (!isR2Configured()) {
    return Response.json({ error: "R2 är inte konfigurerat." }, { status: 503 });
  }

  const expected = process.env.COOLABILDER_UPLOAD_PASSWORD ?? "";
  const supplied = request.headers.get("x-upload-password") ?? "";
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  const matches = expectedBuffer.length > 0
    && suppliedBuffer.length === expectedBuffer.length
    && timingSafeEqual(suppliedBuffer, expectedBuffer);

  return matches ? null : Response.json({ error: "Fel kod." }, { status: 401 });
}

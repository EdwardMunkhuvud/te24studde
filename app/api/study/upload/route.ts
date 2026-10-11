import { revalidatePath } from "next/cache";
import { materialInput, saveStudyFile } from "@/lib/study";
import { readStudyBody, studyErrorResponse, studyUser } from "@/lib/study-request";
import { MAX_STUDY_BYTES } from "@/lib/study-types";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    await studyUser(request, true, true);
    const query = new URL(request.url).searchParams;
    const data = materialInput.parse({
      examId: query.get("examId"), title: decodeURIComponent(request.headers.get("x-study-title") ?? ""),
      description: decodeURIComponent(request.headers.get("x-study-description") ?? ""), sortOrder: Number(query.get("order") ?? 0),
    });
    const fileName = decodeURIComponent(request.headers.get("x-file-name") ?? "material").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200);
    const material = await saveStudyFile(await readStudyBody(request, MAX_STUDY_BYTES), { ...data, fileName });
    revalidatePath("/student"); revalidatePath("/admin");
    return Response.json({ id: material.id }, { status: 201 });
  } catch (error) { return studyErrorResponse(error); }
}

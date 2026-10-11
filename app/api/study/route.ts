import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { availableExam, availableMaterial, deleteStudyMaterial, examInput, getStudyData, linkInput, materialInput, noteInput, StudyError } from "@/lib/study";
import { readStudyBody, studyErrorResponse, studyUser } from "@/lib/study-request";

export const dynamic = "force-dynamic";
const idInput = z.string().min(1).max(100);
export async function GET(request: Request) {
  try {
    const user = await studyUser(request);
    return Response.json(await getStudyData(user.id, user.role === "ADMIN"), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return studyErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const user = await studyUser(request, true);
    const input = z.record(z.unknown()).parse(JSON.parse((await readStudyBody(request, 48000)).toString()));
    const action = z.string().parse(input.action);
    if (["exam-save", "exam-archive", "material-link", "material-save", "material-archive", "material-delete"].includes(action) && user.role !== "ADMIN") throw new StudyError("Bara admin kan ändra prov och material.", 403);
    switch (action) {
      case "exam-save": {
        const data = examInput.parse(input);
        if (input.id) await prisma.studyExam.update({ where: { id: idInput.parse(input.id) }, data });
        else await prisma.studyExam.create({ data });
        break;
      }
      case "exam-archive":
        await prisma.studyExam.update({ where: { id: idInput.parse(input.id) }, data: { archived: z.boolean().parse(input.archived) } });
        break;
      case "material-link": {
        const data = materialInput.parse(input);
        await availableExam(data.examId);
        await prisma.studyMaterial.create({ data: { ...data, kind: "LINK", url: linkInput.parse(input.url) } });
        break;
      }
      case "material-save": {
        const data = materialInput.parse(input); await availableExam(data.examId);
        const existing = await prisma.studyMaterial.findUnique({ where: { id: idInput.parse(input.id) } });
        if (!existing) throw new StudyError("Materialet hittades inte.", 404);
        await prisma.studyMaterial.update({ where: { id: existing.id }, data: {
          ...data, ...(existing.kind === "LINK" ? { url: linkInput.parse(input.url) } : {}),
        } });
        break;
      }
      case "material-archive":
        await prisma.studyMaterial.update({ where: { id: idInput.parse(input.id) }, data: { archived: z.boolean().parse(input.archived) } });
        break;
      case "material-delete":
        z.literal(true).parse(input.confirmed);
        await deleteStudyMaterial(idInput.parse(input.id));
        break;
      case "progress": {
        const materialId = idInput.parse(input.materialId); await availableMaterial(materialId);
        const completed = z.boolean().parse(input.completed);
        await prisma.studyProgress.upsert({ where: { userId_materialId: { userId: user.id, materialId } }, create: { userId: user.id, materialId, completed }, update: { completed } });
        break;
      }
      case "note-save": {
        const data = noteInput.parse(input); const material = await availableMaterial(data.materialId);
        if ((data.page !== null && material.kind !== "PDF") || (data.seconds !== null && material.kind !== "AUDIO") || ((data.x !== null || data.highlights.length) && !["PDF", "IMAGE"].includes(material.kind)) || (data.highlights.length && material.kind === "PDF" && data.page === null)) throw new StudyError("Markeringen passar inte materialet.");
        const stored = { ...data, highlights: JSON.stringify(data.highlights) };
        if (input.id) {
          const result = await prisma.studyNote.updateMany({ where: { id: idInput.parse(input.id), userId: user.id, materialId: data.materialId }, data: stored });
          if (!result.count) throw new StudyError("Anteckningen hittades inte.", 404);
        } else await prisma.studyNote.create({ data: { ...stored, userId: user.id } });
        break;
      }
      case "note-delete": {
        const result = await prisma.studyNote.deleteMany({ where: { id: idInput.parse(input.id), userId: user.id } });
        if (!result.count) throw new StudyError("Anteckningen hittades inte.", 404);
        break;
      }
      default: throw new StudyError("Okänd ändring.");
    }
    revalidatePath("/student"); revalidatePath("/admin");
    return Response.json({ ok: true });
  } catch (error) { return studyErrorResponse(error); }
}

import type { PrismaClient } from "@prisma/client";

// Read from the school account's Google Calendar, Skrivschema TE, on 2026-10-11.
// These are an initial snapshot; later admin edits are intentionally preserved.
export const TE24_EXAMS = [
  { title: "TE24 prov fy2", subject: "Fysik 2", date: "2026-10-16", time: "12:45", endTime: "13:45" },
  { title: "TE24 Övnings-PM, Sv3", subject: "Svenska 3", date: "2026-10-19", time: "08:25", endTime: "11:25", description: "Övning: PM i Svenska 3." },
  { title: "TE24 Matteprov del 1", subject: "Matematik", date: "2026-10-20", time: "14:30", endTime: "15:30" },
  { title: "TE24 Matteprov del 2", subject: "Matematik", date: "2026-10-22", time: "14:55", endTime: "15:55" },
  { title: "Prov TE24 kemi 1 (kap.4)", subject: "Kemi 1", date: "2026-11-04", time: "08:25", endTime: "09:50" },
  { title: "E-test TE24 kemi 1 (kap.5 och 6)", subject: "Kemi 1", date: "2026-12-01", time: "13:15", endTime: "14:10" },
  { title: "Prov TE24 kemi 1 (kap.5 och 6)", subject: "Kemi 1", date: "2026-12-02", time: "08:25", endTime: "09:45" },
  { title: "TE24 prov fy2", subject: "Fysik 2", date: "2026-12-04", time: "12:45", endTime: "13:45" },
  { title: "TE24 Matteprov del 1", subject: "Matematik", date: "2026-12-15", time: "14:30", endTime: "15:30" },
  { title: "TE24 Matteprov del 2", subject: "Matematik", date: "2026-12-17", time: "14:55", endTime: "15:55" },
  { title: "TE24 prov fy2", subject: "Fysik 2", date: "2027-02-05", time: "12:45", endTime: "13:45" },
  { title: "TE24 prov fy2", subject: "Fysik 2", date: "2027-03-19", time: "12:45", endTime: "13:45" },
  { title: "TE24 prov fy2", subject: "Fysik 2", date: "2027-04-23", time: "12:45", endTime: "13:45" },
];
export async function seedStudyExams(prisma: PrismaClient) {
  for (const exam of TE24_EXAMS) {
    const sourceKey = `skrivschema-te:${exam.date}:${exam.time}`;
    await prisma.studyExam.upsert({ where: { sourceKey }, create: { ...exam, sourceKey }, update: {} });
  }
}

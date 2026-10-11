export type StudyHighlight = { x: number; y: number; width: number; height: number };
export type StudyNote = {
  id: string; body: string; quote: string; section: string; page: number | null;
  x: number | null; y: number | null; seconds: number | null; highlights: StudyHighlight[]; updatedAt: string;
};
export type StudyMaterial = {
  id: string; examId: string; title: string; description: string;
  kind: "PDF" | "IMAGE" | "AUDIO" | "LINK"; url: string | null;
  fileName: string; byteSize: number; sortOrder: number; archived: boolean;
  completed: boolean; notes: StudyNote[];
};
export type StudyExam = {
  id: string; title: string; subject: string; date: string; time: string; endTime: string;
  location: string; description: string; archived: boolean; materials: StudyMaterial[];
};
export type StudyData = { exams: StudyExam[] };
export type NoteAnchor = Pick<StudyNote, "quote" | "section" | "page" | "x" | "y" | "seconds" | "highlights">;
export const EMPTY_ANCHOR: NoteAnchor = { quote: "", section: "", page: null, x: null, y: null, seconds: null, highlights: [] };
export const MATERIAL_LABELS = { PDF: "PDF", IMAGE: "Bild", AUDIO: "Ljud", LINK: "Länk" };
export const MAX_STUDY_BYTES = 40 * 1024 * 1024;
export function stockholmDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function daysUntil(date: string, today: string) {
  return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
}
export function studyDate(date: string) {
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
export function audioTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

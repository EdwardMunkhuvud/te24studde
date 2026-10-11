"use client";
import { useState, type FormEvent } from "react";
import { Archive, Link2, Plus, Upload } from "lucide-react";
import { MAX_STUDY_BYTES, studyDate, type StudyExam, type StudyMaterial } from "@/lib/study-types";
import styles from "./study-hub.module.css";

export type StudyMutate = (data: Record<string, unknown>, message: string) => Promise<boolean>;
function values(form: HTMLFormElement) { return Object.fromEntries(new FormData(form)); }

function ExamForm({ exam, mutate, busy }: { exam?: StudyExam; mutate: StudyMutate; busy: boolean }) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget;
    if (await mutate({ action: "exam-save", id: exam?.id, ...values(form) }, exam ? "Provet är uppdaterat." : "Provet är tillagt.")) { if (!exam) form.reset(); }
  }
  return <form className={styles.form} onSubmit={submit}>
    <label>Titel<input name="title" defaultValue={exam?.title} required maxLength={150} placeholder="Till exempel: Matteprov del 1" /></label>
    <div className={styles.formRow}>
      <label>Ämne<input name="subject" defaultValue={exam?.subject} required maxLength={60} placeholder="Matematik" /></label>
      <label>Datum<input name="date" type="date" defaultValue={exam?.date} required /></label>
    </div>
    <div className={styles.formRow}>
      <label>Starttid<input name="time" type="time" defaultValue={exam?.time} /></label>
      <label>Sluttid<input name="endTime" type="time" defaultValue={exam?.endTime} /></label>
    </div>
    <label>Sal / plats<input name="location" defaultValue={exam?.location} maxLength={150} placeholder="Valfritt" /></label>
    <label>Vad ska vi kunna?<textarea name="description" defaultValue={exam?.description} maxLength={3000} rows={3} placeholder="Kapitel, moment eller annan information inför provet" /></label>
    <button className="button button-primary" disabled={busy}>{busy ? "Sparar…" : exam ? "Spara prov" : "Lägg till prov"}</button>
  </form>;
}

function MaterialForm({ material, exams, mutate, busy }: { material: StudyMaterial; exams: StudyExam[]; mutate: StudyMutate; busy: boolean }) {
  return <form className={styles.form} onSubmit={async (e) => {
    e.preventDefault(); const data = values(e.currentTarget);
    await mutate({ action: "material-save", id: material.id, ...data, sortOrder: Number(data.sortOrder) }, "Materialet är uppdaterat.");
  }}>
    <label>Titel<input name="title" required maxLength={150} defaultValue={material.title} /></label>
    <label>Beskrivning<textarea name="description" maxLength={1500} defaultValue={material.description} rows={2} /></label>
    <div className={styles.formRow}>
      <label>Kopplat till prov<select name="examId" defaultValue={material.examId}>{exams.filter((exam) => !exam.archived || exam.id === material.examId).map((exam) => <option key={exam.id} value={exam.id}>{exam.title} · {studyDate(exam.date)}</option>)}</select></label>
      <label>Ordning<input type="number" name="sortOrder" min={0} max={999} defaultValue={material.sortOrder} required /></label>
    </div>
    {material.kind === "LINK" ? <label>Länk<input name="url" type="url" defaultValue={material.url ?? ""} required maxLength={2000} /></label> : null}
    <div className={styles.row}>
      <button className="button button-primary" disabled={busy}>Spara material</button>
      <button type="button" className="button button-secondary" disabled={busy} onClick={() => mutate({ action: "material-archive", id: material.id, archived: !material.archived }, material.archived ? "Materialet är återställt." : "Materialet är arkiverat. Anteckningarna finns kvar.")}><Archive size={16} />{material.archived ? "Återställ" : "Arkivera"}</button>
    </div>
  </form>;
}

export function StudyAdmin({ exams, mutate, busy, upload }: {
  exams: StudyExam[]; mutate: StudyMutate; busy: boolean;
  upload: (files: File[], examId: string, title: string, description: string) => Promise<boolean>;
}) {
  const active = exams.filter((e) => !e.archived);
  const [type, setType] = useState("file"); const [uploading, setUploading] = useState(false);
  return <div className={styles.admin}>
    <div className={styles.adminIntro}><div><span className={styles.kicker}>Ditt kontrollrum</span><h2>Ordning inför varje prov</h2><p className={styles.subtle}>Lägg till prov, samla material och välj i vilken ordning klassen ska läsa det.</p></div><span className={styles.pill}>{active.length} aktiva tillfällen</span></div>
    <div className={styles.adminGrid}>
      <details className={styles.card}><summary><Plus size={18} />Nytt prov</summary><ExamForm mutate={mutate} busy={busy} /></details>
      <section className={styles.card}>
        <h3><Upload size={18} />Lägg till material</h3>
        {!active.length ? <p className={styles.subtle}>Skapa ett prov först för att koppla ditt material.</p> : <>
          <div className={styles.segment}><button className={type === "file" ? styles.selected : ""} onClick={() => setType("file")}><Upload size={15} />Filer</button><button className={type === "link" ? styles.selected : ""} onClick={() => setType("link")}><Link2 size={15} />Länk</button></div>
          <form key={type} className={styles.form} onSubmit={async (e) => {
            e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
            if (type === "link") {
              if (await mutate({ action: "material-link", ...Object.fromEntries(data), sortOrder: 0 }, "Länken är tillagd.")) form.reset();
            } else {
              const files = data.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
              setUploading(true);
              try { if (await upload(files, String(data.get("examId")), String(data.get("title")), String(data.get("description")))) form.reset(); }
              finally { setUploading(false); }
            }
          }}>
            <label>Vilket prov?<select name="examId" required>{active.map((exam) => <option key={exam.id} value={exam.id}>{exam.title} · {studyDate(exam.date)}</option>)}</select></label>
            <label>Titel{type === "file" ? " (valfritt för filer)" : ""}<input name="title" maxLength={150} required={type === "link"} placeholder={type === "file" ? "Filnamnet används om du lämnar tomt" : "Till exempel: Repetitionsfrågor"} /></label>
            <label>Beskrivning<textarea name="description" maxLength={1500} rows={2} placeholder="Vad ska man fokusera på i materialet?" /></label>
            {type === "file" ? <label className={styles.dropzone}><Upload size={24} /><strong>Välj en eller flera filer</strong><span>PDF, bilder och ljud · högst {MAX_STUDY_BYTES / 1024 / 1024} MB per fil</span><input name="files" type="file" required multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.ogg,.m4a,application/pdf,image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/wav,audio/ogg,audio/mp4" /></label> : <label>Webbadress<input type="url" name="url" required maxLength={2000} placeholder="https://…" /></label>}
            <button className="button button-primary" disabled={busy || uploading}>{busy || uploading ? "Sparar…" : type === "file" ? "Ladda upp och koppla till prov" : "Lägg till länk"}</button>
          </form>
        </>}
      </section>
    </div>
    <h3>Prov och material</h3>
    <p className={styles.subtle}>Arkivering döljer innehåll för klassen. Filer och personliga anteckningar bevaras och kan återställas.</p>
    {!exams.length ? <p className={styles.empty}>Inga prov ännu. Lägg till det första ovan.</p> : exams.map((exam) => <details key={exam.id} className={`${styles.card} ${exam.archived ? styles.archived : ""}`}>
      <summary><div><strong>{exam.title}</strong><span>{studyDate(exam.date)} · {exam.materials.filter((m) => !m.archived).length} material{exam.archived ? " · Arkiverat" : ""}</span></div></summary>
      <ExamForm exam={exam} mutate={mutate} busy={busy} />
      <button className="button button-secondary" disabled={busy} onClick={() => mutate({ action: "exam-archive", id: exam.id, archived: !exam.archived }, exam.archived ? "Provet är återställt." : "Provet är arkiverat.")}><Archive size={16} />{exam.archived ? "Återställ prov" : "Arkivera prov"}</button>
      <div className={styles.materialAdminList}>{exam.materials.length ? exam.materials.map((m) => <details key={m.id} className={styles.nested}><summary>{m.title} · {m.kind === "LINK" ? "Länk" : m.fileName}{m.archived ? " · Arkiverat" : ""}</summary><MaterialForm material={m} exams={exams} mutate={mutate} busy={busy} /></details>) : <p className={styles.subtle}>Inget material kopplat ännu.</p>}</div>
    </details>)}
  </div>;
}

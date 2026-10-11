"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Check, FileText, Headphones, Image as ImageIcon, Link2, MessageSquare, Search, Settings2 } from "lucide-react";
import { daysUntil, MATERIAL_LABELS, MAX_STUDY_BYTES, stockholmDate, studyDate, type StudyData, type StudyMaterial } from "@/lib/study-types";
import { StudyAdmin } from "./study-admin";
import { StudyMaterialReader } from "./study-material";
import { StudyTimer, useStudyTimer } from "./study-timer";
import styles from "./study-hub.module.css";

const icons = { PDF: FileText, IMAGE: ImageIcon, AUDIO: Headphones, LINK: Link2 };
export function StudyHub({ initialData, admin, today: initialToday }: { initialData: StudyData; admin: boolean; today: string }) {
  const timer = useStudyTimer();
  const [data, setData] = useState(initialData); const [today, setToday] = useState(initialToday);
  const [view, setView] = useState("schedule"); const [search, setSearch] = useState(""); const [subject, setSubject] = useState(""); const [period, setPeriod] = useState("upcoming");
  const [examId, setExamId] = useState<string | null>(null); const [materialId, setMaterialId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const busyRef = useRef(false); const sequence = useRef(0);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    const response = await fetch("/api/study", { cache: "no-store" });
    const updated = await response.json(); if (!response.ok) throw new Error(updated.error ?? "Studiehubben kunde inte hämtas.");
    if (current === sequence.current) { setData(updated); setToday(stockholmDate()); }
  }, []);
  useEffect(() => {
    const sync = () => { if (document.visibilityState === "visible" && !busyRef.current) refresh().catch((error) => setMessage({ error: true, text: error.message })); };
    window.addEventListener("focus", sync); document.addEventListener("visibilitychange", sync);
    return () => { window.removeEventListener("focus", sync); document.removeEventListener("visibilitychange", sync); };
  }, [refresh]);
  const mutate = async (input: Record<string, unknown>, success: string) => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/study", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      await refresh(); setMessage({ error: false, text: success }); return true;
    } catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "Ändringen kunde inte sparas." }); return false; }
    finally { busyRef.current = false; setBusy(false); }
  };
  const upload = async (files: File[], targetId: string, title: string, description: string) => {
    if (busyRef.current) return false;
    if (!files.length || files.length > 20 || files.some((f) => f.size > MAX_STUDY_BYTES)) { setMessage({ error: true, text: "Välj 1–20 filer, högst 40 MB per fil." }); return false; }
    busyRef.current = true; setBusy(true); setMessage(null); let count = 0;
    try {
      for (const file of files) {
        setMessage({ error: false, text: `Laddar upp ${count + 1} av ${files.length}: ${file.name}` });
        const response = await fetch(`/api/study/upload?examId=${encodeURIComponent(targetId)}`, { method: "POST", body: file, headers: {
          "x-file-name": encodeURIComponent(file.name), "x-study-title": encodeURIComponent((files.length === 1 ? title.trim() || file.name : title.trim() ? `${title.trim()} · ${file.name}` : file.name).slice(0, 150)),
          "x-study-description": encodeURIComponent(description),
        } });
        const result = await response.json(); if (!response.ok) throw new Error(`${file.name}: ${result.error}`); count++;
      }
      await refresh(); setMessage({ error: false, text: `${count} ${count === 1 ? "fil är uppladdad" : "filer är uppladdade"} och kopplad${count === 1 ? "" : "e"} till provet.` }); return true;
    } catch (error) {
      await refresh().catch(() => {});
      setMessage({ error: true, text: `${count ? `${count} filer sparades. ` : ""}${error instanceof Error ? error.message : "Uppladdningen misslyckades."} Välj bara återstående filer när du försöker igen.` }); return false;
    } finally { busyRef.current = false; setBusy(false); }
  };
  const exams = data.exams.filter((e) => !e.archived);
  const materials = exams.flatMap((e) => e.materials.filter((m) => !m.archived));
  const upcoming = exams.filter((e) => e.date >= today);
  const next = upcoming[0];
  const selectedExam = exams.find((e) => e.id === examId);
  const selectedMaterial = materials.find((m) => m.id === materialId);
  const selectedMaterialExam = selectedMaterial && exams.find((e) => e.id === selectedMaterial.examId);
  const completed = materials.filter((m) => m.completed).length;
  const notes = materials.flatMap((m) => m.notes.map((note) => ({ note, material: m, exam: exams.find((e) => e.id === m.examId)! })));
  const filtered = exams.filter((e) => (period === "all" || (period === "past" ? e.date < today : e.date >= today)) && (!subject || e.subject === subject) && `${e.title} ${e.subject} ${e.description}`.toLocaleLowerCase("sv").includes(search.toLocaleLowerCase("sv")));
  function openMaterial(material: StudyMaterial, note?: string) { setExamId(material.examId); setMaterialId(material.id); setNoteId(note ?? null); }
  const materialRow = (m: StudyMaterial) => {
    const Icon = icons[m.kind];
    return <article key={m.id} className={styles.materialRow}>
      <span className={`${styles.fileIcon} ${styles[m.kind.toLowerCase()]}`}><Icon size={23} /></span>
      <button className={styles.materialTitle} onClick={() => openMaterial(m)}><strong>{m.title}</strong><span>{MATERIAL_LABELS[m.kind]}{m.byteSize ? ` · ${(m.byteSize / 1024 / 1024).toFixed(1)} MB` : ""}{m.notes.length ? ` · ${m.notes.length} anteckningar` : ""}</span>{m.description ? <p>{m.description}</p> : null}</button>
      <div className={styles.materialActions}><label className={styles.check}><input type="checkbox" checked={m.completed} disabled={busy} onChange={() => mutate({ action: "progress", materialId: m.id, completed: !m.completed }, m.completed ? "Materialet är kvar att läsa." : "Materialet är avbockat.")} /><span>{m.completed ? "Genomgånget" : "Klart?"}</span></label><button className="button button-secondary" onClick={() => openMaterial(m)}>Öppna <ArrowUpRight size={16} /></button></div>
    </article>;
  };
  return <div className={styles.hub}>
    <header className={styles.hero}><div><span className={styles.kicker}><BookOpen size={16} />TE24 · Studiehubb</span><h1>Lite mer koll.<br /><span>Lite mindre provstress.</span></h1><p>Alla prov, allt material och dina egna förklaringar. Samlat på ett ställe.</p></div><div className={styles.heroStamp}><BookOpen size={42} /><span>En sak i taget.<br />Du har det här.</span></div></header>
    <nav className={styles.navigation} aria-label="Studiehubbens vyer">
      <button aria-current={view === "schedule" ? "page" : undefined} className={view === "schedule" ? styles.selected : ""} onClick={() => { setView("schedule"); setMaterialId(null); }}><CalendarDays size={17} />Provschema<span>{upcoming.length}</span></button>
      <button aria-current={view === "notes" ? "page" : undefined} className={view === "notes" ? styles.selected : ""} onClick={() => { setView("notes"); setMaterialId(null); setExamId(null); }}><MessageSquare size={17} />Mina anteckningar<span>{notes.length}</span></button>
      {admin ? <button aria-current={view === "admin" ? "page" : undefined} className={view === "admin" ? styles.selected : ""} onClick={() => { setView("admin"); setMaterialId(null); setExamId(null); }}><Settings2 size={17} />Hantera</button> : null}
    </nav>
    {message ? <div className={message.error ? styles.errorBanner : styles.successBanner} role={message.error ? "alert" : "status"}>{message.text}</div> : null}
    {selectedMaterial && selectedMaterialExam ? <StudyMaterialReader key={selectedMaterial.id} initialNoteId={noteId} timer={timer} material={selectedMaterial} examTitle={selectedMaterialExam.title} mutate={mutate} busy={busy} onBack={() => setMaterialId(null)} /> : view === "admin" && admin ? <StudyAdmin exams={data.exams} mutate={mutate} busy={busy} upload={upload} /> : view === "notes" ? <section className={styles.notesView}><div><span className={styles.kicker}>Dina förklaringar</span><h2>Det du vill komma ihåg</h2><p className={styles.subtle}>Privata anteckningar, sparade på ditt konto. Öppna en anteckning för att hitta tillbaka till materialet.</p></div>
      <label className={styles.search}><Search size={18} /><input aria-label="Sök i anteckningar" placeholder="Sök i dina anteckningar…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <div className={styles.noteGrid}>{notes.filter(({ note, material }) => `${note.body} ${note.quote} ${note.section} ${material.title}`.toLowerCase().includes(search.toLowerCase())).map(({ note, material, exam }) => <button key={note.id} className={styles.noteCard} onClick={() => { setView("schedule"); openMaterial(material, note.id); }}><span className={styles.kicker}>{exam.subject} · {note.page ? `Sida ${note.page}` : note.section || MATERIAL_LABELS[material.kind]}</span><strong>{material.title}</strong>{note.quote ? <blockquote>{note.quote}</blockquote> : null}<p>{note.body}</p><span className={styles.subtle}>Öppna material <ArrowUpRight size={15} /></span></button>)}</div>
      {!notes.length ? <div className={styles.empty}><MessageSquare size={28} /><h3>Samla dina egna aha-ögonblick</h3><p>Öppna ett material vid ett prov och skriv din första anteckning där.</p></div> : null}
    </section> : selectedExam ? <section className={styles.examDetail}>
      <button className={styles.back} onClick={() => setExamId(null)}><ArrowLeft size={17} />Alla prov</button><div className={styles.detailHeader}><div><span className={styles.kicker}>{selectedExam.subject}</span><h2>{selectedExam.title}</h2><p className={styles.subtle}>{studyDate(selectedExam.date)}{selectedExam.time ? ` · ${selectedExam.time}${selectedExam.endTime ? `–${selectedExam.endTime}` : ""}` : " · Tid meddelas"}{selectedExam.location ? ` · ${selectedExam.location}` : ""}</p></div><span className={styles.pill}>{selectedExam.materials.filter((m) => !m.archived && m.completed).length} / {selectedExam.materials.filter((m) => !m.archived).length} genomgångna</span></div>
      {selectedExam.description ? <p className={styles.examDescription}>{selectedExam.description}</p> : null}
      <div className={styles.materialList}>{selectedExam.materials.filter((m) => !m.archived).map(materialRow)}</div>
      {!selectedExam.materials.some((m) => !m.archived) ? <div className={styles.empty}><BookOpen size={30} /><h3>Material kommer snart</h3><p>{admin ? "Lägg till filer eller länkar i Hantera och koppla dem till det här provet." : "Admin lägger upp material här inför provet."}</p>{admin ? <button className="button button-primary" onClick={() => { setView("admin"); setExamId(null); }}>Lägg till material</button> : null}</div> : null}
      <StudyTimer timer={timer} />
    </section> : <>
      <div className={styles.overview}><section className={styles.nextExam}>{next ? <><span className={styles.kicker}>Näst på tur</span><div className={styles.nextTitle}><h2>{next.title}</h2><span className={styles.countdown}>{daysUntil(next.date, today) === 0 ? "I dag" : `${daysUntil(next.date, today)} dagar kvar`}</span></div><p>{studyDate(next.date)}{next.time ? ` · ${next.time}${next.endTime ? `–${next.endTime}` : ""}` : ""}</p><button className="button button-primary" onClick={() => setExamId(next.id)}>Plugga inför provet <ArrowUpRight size={17} /></button></> : <><span className={styles.kicker}>Andrum</span><h2>Inga kommande prov just nu</h2><p>Du kan fortfarande repetera tidigare material.</p></>}</section><StudyTimer timer={timer} /></div>
      <div className={styles.scheduleHeader}><div><span className={styles.kicker}>Din plan framåt</span><h2>Provschemat</h2></div><span className={styles.subtle}><Check size={15} />{completed} av {materials.length} material genomgångna</span></div>
      <div className={styles.filters}><label className={styles.search}><Search size={17} /><input aria-label="Sök prov" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök prov eller ämne…" /></label><select aria-label="Filtrera ämne" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">Alla ämnen</option>{[...new Set(exams.map((e) => e.subject))].sort().map((s) => <option key={s}>{s}</option>)}</select><select aria-label="Visa prov" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="upcoming">Kommande</option><option value="past">Tidigare</option><option value="all">Alla tillfällen</option></select></div>
      <div className={styles.examGrid}>{filtered.map((exam) => {
        const rows = exam.materials.filter((m) => !m.archived); const done = rows.filter((m) => m.completed).length; const days = daysUntil(exam.date, today);
        return <article key={exam.id} className={styles.examCard}><div className={styles.examTop}><span className={styles.subject}>{exam.subject}</span><span className={styles.subtle}>{days === 0 ? "I dag" : days > 0 ? `${days} dagar kvar` : "Tidigare tillfälle"}</span></div><h3>{exam.title}</h3><p className={styles.date}><CalendarDays size={16} />{studyDate(exam.date)}</p><p className={styles.subtle}>{exam.time ? `${exam.time}${exam.endTime ? `–${exam.endTime}` : ""}` : "Tid meddelas"}{exam.location ? ` · ${exam.location}` : ""}</p>{exam.description ? <p className={styles.cardDescription}>{exam.description}</p> : null}<div className={styles.examBottom}><span className={styles.subtle}>{rows.length ? `${done} / ${rows.length} material genomgångna` : "Material kommer snart"}</span>{rows.length ? <div className={styles.progress} aria-label={`${done} av ${rows.length} material genomgångna`}><span style={{ width: `${done / rows.length * 100}%` }} /></div> : null}<button className="button button-secondary" onClick={() => setExamId(exam.id)}>Studiematerial <ArrowUpRight size={16} /></button></div></article>;
      })}</div>
      {!filtered.length ? <div className={styles.empty}><CalendarDays size={28} /><h3>Inga prov i den här vyn</h3><p>Prova ett annat ämne eller välj alla tillfällen.</p></div> : null}
      <p className={styles.sourceNote}>TE24:s första schema hämtades från skolkalendern Skrivschema TE den 11 oktober 2026. Tider visas i svensk tid. Admin uppdaterar framtida ändringar här.</p>
    </>}
  </div>;
}

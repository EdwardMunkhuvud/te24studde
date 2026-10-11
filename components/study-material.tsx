"use client";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { ArrowLeft, Check, Download, ExternalLink, FileText, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { audioTime, EMPTY_ANCHOR, MATERIAL_LABELS, type NoteAnchor, type StudyMaterial, type StudyNote } from "@/lib/study-types";
import type { StudyMutate } from "./study-admin";
import { StudyTimer, type StudyTimerState } from "./study-timer";
import { StudyAnnotations, StudyArea } from "./study-annotations";
import styles from "./study-hub.module.css";

const Pdf = dynamic(() => import("./study-pdf").then((m) => m.StudyPdf), { ssr: false, loading: () => <p className={styles.subtle}>Öppnar PDF-läsaren…</p> });
function anchorLabel(note: NoteAnchor) {
  return [note.page ? `Sida ${note.page}` : "", note.seconds !== null ? audioTime(note.seconds) : "", note.section, note.highlights.length ? "Markerat område" : note.x !== null ? "Markerad plats" : ""].filter(Boolean).join(" · ") || "Hela materialet";
}
export function StudyMaterialReader({ material, examTitle, mutate, busy, onBack, initialNoteId, timer }: {
  material: StudyMaterial; examTitle: string; mutate: StudyMutate; busy: boolean; onBack: () => void;
  initialNoteId: string | null; timer: StudyTimerState;
}) {
  const initialNote = material.notes.find((note) => note.id === initialNoteId);
  const [page, setPage] = useState(initialNote?.page ?? 1); const [anchor, setAnchor] = useState<NoteAnchor>({ ...EMPTY_ANCHOR, page: material.kind === "PDF" ? initialNote?.page ?? 1 : null });
  const [body, setBody] = useState(""); const [editing, setEditing] = useState<string | null>(null);
  const [spot, setSpot] = useState<(NoteAnchor & { id?: string }) | null>(initialNote ?? null); const [saved, setSaved] = useState(false);
  const [saveHighlight, setSaveHighlight] = useState(true); const [areaMode, setAreaMode] = useState(false);
  const [audioError, setAudioError] = useState(false); const [imageError, setImageError] = useState(false);
  const audio = useRef<HTMLAudioElement>(null); const noteInput = useRef<HTMLTextAreaElement>(null);
  const content = `/api/study/materials/${material.id}/content`;
  const updateAnchor = (update: Partial<NoteAnchor>) => { setAnchor((old) => ({ ...old, ...update })); setSpot({ ...anchor, ...update }); setSaveHighlight(true); setSaved(false); };
  const showNote = (note: StudyNote) => {
    setSpot(note);
    document.getElementById(`study-note-${note.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const jump = (note: StudyNote) => {
    if (note.page) setPage(note.page);
    if (note.seconds !== null && audio.current) audio.current.currentTime = note.seconds;
    setSpot(note);
    document.getElementById("study-viewer")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const reset = () => { setBody(""); setEditing(null); setAnchor({ ...EMPTY_ANCHOR, page: material.kind === "PDF" ? page : null }); setSpot(null); };
  return <section className={styles.reader}>
    <button className={styles.back} onClick={onBack}><ArrowLeft size={17} />Tillbaka till provmaterial</button>
    <div className={styles.readerHeading}><div><span className={styles.kicker}>{examTitle}</span><h2>{material.title}</h2><p className={styles.subtle}>{material.description}</p></div><span className={styles.pill}>{MATERIAL_LABELS[material.kind]}</span></div>
    <div className={styles.row}>
      <button className={`button ${material.completed ? "button-secondary" : "button-primary"}`} disabled={busy} onClick={() => mutate({ action: "progress", materialId: material.id, completed: !material.completed }, material.completed ? "Markerat som kvar att läsa." : "Bra jobbat! Materialet är avbockat.")}><Check size={16} />{material.completed ? "Genomgånget · ångra" : "Markera som genomgånget"}</button>
      {material.kind === "LINK" ? <a className="button button-secondary" href={material.url ?? "#"} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />Öppna länk</a> : <a className="button button-secondary" href={`${content}?download=1`}><Download size={16} />Ladda ner</a>}
    </div>
    <div className={styles.readerGrid}>
      <article className={styles.viewer} id="study-viewer">
        {material.kind === "PDF" ? <Pdf url={content} page={page} onPage={(value) => { setPage(value); updateAnchor({ page: value, quote: "", x: null, y: null, highlights: [] }); }} onAnchor={updateAnchor} marker={spot?.page === page ? spot : null} notes={material.notes} onNote={showNote} /> : null}
        {material.kind === "IMAGE" ? <>
          <div className={styles.selectionTools}><button className="button button-secondary" aria-pressed={areaMode} onClick={() => setAreaMode(!areaMode)}>{areaMode ? "Avsluta områdesmarkering" : "Markera område"}</button><span className={styles.subtle}>{areaMode ? "Dra en ruta runt det du vill anteckna om." : "Tryck på en plats eller välj Markera område."}</span></div>
          <StudyArea className={styles.imageArea} areaMode={areaMode} disabled={imageError}
            onArea={(highlight) => updateAnchor({ ...EMPTY_ANCHOR, highlights: [highlight] })}
            onPick={(point) => { updateAnchor({ ...EMPTY_ANCHOR, ...point }); noteInput.current?.focus(); }}>
            {/* Authenticated file URLs cannot use Next's anonymous image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content} alt={material.title} draggable={false} onError={() => setImageError(true)} />
            <StudyAnnotations notes={material.notes} draft={spot} activeId={spot?.id} onNote={showNote} />
          </StudyArea>
          {imageError ? <p role="alert" className={styles.error}>Bilden kunde inte hämtas. Försök ladda ner den.</p> : null}
        </> : null}
        {material.kind === "AUDIO" ? <div className={styles.audioArea}><span className={styles.audioIcon}>♪</span><h3>{material.title}</h3><audio ref={audio} controls preload="metadata" src={content} onLoadedMetadata={() => { if (initialNote?.seconds !== null && initialNote?.seconds !== undefined && audio.current) audio.current.currentTime = initialNote.seconds; }} onError={() => setAudioError(true)} />
          <button className="button button-secondary" onClick={() => { updateAnchor({ ...EMPTY_ANCHOR, seconds: Math.floor(audio.current?.currentTime ?? 0) }); noteInput.current?.focus(); }}><MessageSquare size={16} />Anteckna vid aktuell tid</button>
          {audioError ? <p role="alert" className={styles.error}>Webbläsaren kunde inte spela ljudet. Prova att ladda ner filen.</p> : <p className={styles.subtle}>Anteckningar med tid kan ta dig tillbaka till rätt ställe i ljudet.</p>}
        </div> : null}
        {material.kind === "LINK" ? <div className={styles.linkArea}><ExternalLink size={36} /><h3>En resurs utanför Studde</h3><p className={styles.subtle}>{material.url}</p><a className="button button-primary" href={material.url ?? "#"} target="_blank" rel="noopener noreferrer">Öppna studiematerial <ExternalLink size={16} /></a><p className={styles.subtle}>Skriv ett citat eller namnet på ett avsnitt i din anteckning för att hitta tillbaka.</p></div> : null}
      </article>
      <div className={styles.readerSide}><StudyTimer timer={timer} /><aside className={styles.notePanel}>
        <div><span className={styles.kicker}>Bara för dig</span><h3><MessageSquare size={18} />Mina anteckningar</h3><p className={styles.subtle}>Sparas på ditt konto och följer med till dina andra enheter.</p></div>
        <form className={styles.form} onSubmit={async (e) => {
          e.preventDefault();
          if (await mutate({ ...anchor, action: "note-save", id: editing ?? undefined, materialId: material.id, body, highlights: saveHighlight ? anchor.highlights : [] }, "Din privata anteckning är sparad.")) { reset(); setSaved(true); }
        }}>
          <div className={styles.anchor}><FileText size={15} /><span>{anchorLabel(anchor)}</span><button type="button" onClick={() => { setAnchor(EMPTY_ANCHOR); setSpot(null); }}>Hela filen</button></div>
          {anchor.highlights.length ? <div><label className={styles.check}><input type="checkbox" checked={saveHighlight} onChange={(e) => setSaveHighlight(e.target.checked)} /><span>Spara markeringen med anteckningen</span></label><button type="button" className={styles.textButton} onClick={() => updateAnchor({ highlights: [], x: null, y: null })}>Ta bort markering</button></div> : null}
          {material.kind === "PDF" ? <label>Sidnummer (valfritt)<input type="number" min={1} max={100000} value={anchor.page ?? ""} onChange={(e) => { const value = Number(e.target.value); updateAnchor({ page: value >= 1 ? value : null, x: null, y: null, highlights: [] }); }} /></label> : null}
          {material.kind === "AUDIO" ? <label>Tid i sekunder (valfritt)<input type="number" min={0} max={86400} value={anchor.seconds ?? ""} onChange={(e) => setAnchor((old) => ({ ...old, seconds: e.target.value === "" ? null : Number(e.target.value) }))} /></label> : null}
          <label>Avsnitt / område<input maxLength={150} value={anchor.section} onChange={(e) => setAnchor((old) => ({ ...old, section: e.target.value }))} placeholder="Till exempel: Uppgift 4 eller begreppet energi" /></label>
          <label>Citat (valfritt)<textarea rows={2} maxLength={1000} value={anchor.quote} onChange={(e) => setAnchor((old) => ({ ...old, quote: e.target.value }))} placeholder="Markerad text eller ett textstycke du vill förklara" /></label>
          <label>Din anteckning<textarea ref={noteInput} rows={4} required maxLength={4000} value={body} onChange={(e) => { setBody(e.target.value); setSaved(false); }} placeholder="Skriv en förklaring, minnesregel eller fråga till dig själv…" /></label>
          <div className={styles.row}><button className="button button-primary" disabled={busy || !body.trim()}>{busy ? "Sparar…" : editing ? "Spara ändring" : "Spara anteckning"}</button>{editing ? <button type="button" className={styles.textButton} onClick={reset}>Avbryt</button> : null}</div>
          {saved ? <p role="status" className={styles.success}>Anteckningen är sparad på ditt konto.</p> : null}
        </form>
        <div className={styles.notes}>{material.notes.length ? material.notes.map((note) => <article key={note.id} id={`study-note-${note.id}`} className={`${styles.note} ${spot?.id === note.id ? styles.activeNote : ""}`}>
          <button className={styles.noteJump} onClick={() => jump(note)}>{anchorLabel(note)} <span>↗</span></button>
          {note.quote ? <blockquote>{note.quote}</blockquote> : null}<p>{note.body}</p>
          <div className={styles.row}><button className={styles.textButton} onClick={() => { setEditing(note.id); setBody(note.body); setAnchor(note); setSaveHighlight(true); setSaved(false); jump(note); noteInput.current?.focus(); }}><Pencil size={14} />Ändra</button><button className={styles.textButton} disabled={busy} onClick={async () => { if (await mutate({ action: "note-delete", id: note.id }, "Anteckningen är borttagen.")) { if (editing === note.id) reset(); else if (spot?.id === note.id) setSpot(null); } }}><Trash2 size={14} />Ta bort</button></div>
        </article>) : <p className={styles.empty}>Din första förklaring börjar här.</p>}</div>
      </aside></div>
    </div>
  </section>;
}

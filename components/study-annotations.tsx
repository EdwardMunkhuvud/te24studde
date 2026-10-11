"use client";
import { useRef, useState, type ReactNode } from "react";
import { relativeHighlight } from "@/lib/study-highlights";
import type { NoteAnchor, StudyHighlight, StudyNote } from "@/lib/study-types";
import styles from "./study-hub.module.css";

export function StudyAnnotations({ notes, draft, activeId, onNote }: {
  notes: StudyNote[]; draft: NoteAnchor | null; activeId?: string; onNote: (note: StudyNote) => void;
}) {
  const rect = (highlight: StudyHighlight, key: string, active: boolean) => <span key={key}
    className={`${styles.highlight} ${active ? styles.highlightActive : ""}`}
    style={{ left: `${highlight.x * 100}%`, top: `${highlight.y * 100}%`, width: `${highlight.width * 100}%`, height: `${highlight.height * 100}%` }} />;
  return <div className={styles.annotationLayer}>
    {notes.map((note, index) => {
      const first = note.highlights[0];
      return <div key={note.id}>
        {note.highlights.map((h, i) => rect(h, `${note.id}-${i}`, note.id === activeId))}
        {first ? <button type="button" className={styles.annotationBadge}
          style={{ left: `${first.x * 100}%`, top: `${first.y * 100}%` }}
          aria-label={`Visa anteckning: ${note.body.slice(0, 100)}`} title={note.body.slice(0, 100)}
          onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onNote(note); }}>{index + 1}</button> : null}
      </div>;
    })}
    {!activeId ? draft?.highlights.map((h, i) => rect(h, `draft-${i}`, true)) : null}
    {draft?.x !== null && draft?.x !== undefined && draft.y !== null && !draft.highlights.length ? <span className={styles.marker}
      style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }} aria-label="Markerad plats" /> : null}
  </div>;
}

export function StudyArea({ children, className, areaMode, disabled = false, onArea, onPick }: {
  children: ReactNode; className: string; areaMode: boolean; disabled?: boolean;
  onArea: (highlight: StudyHighlight) => void;
  onPick: (point: { x: number; y: number }, element: HTMLDivElement) => void;
}) {
  const drag = useRef<{ x: number; y: number; pointer: number } | null>(null);
  const [preview, setPreview] = useState<StudyHighlight | null>(null);
  const highlightAt = (element: HTMLDivElement, x: number, y: number) => {
    const start = drag.current;
    return start ? relativeHighlight({ left: Math.min(start.x, x), top: Math.min(start.y, y), right: Math.max(start.x, x), bottom: Math.max(start.y, y) }, element.getBoundingClientRect()) : null;
  };
  return <div className={`${className} ${areaMode ? styles.areaMode : ""}`} onPointerDown={(e) => {
    if (!areaMode || disabled || e.button !== 0) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, pointer: e.pointerId };
  }} onPointerMove={(e) => {
    if (drag.current?.pointer === e.pointerId) setPreview(highlightAt(e.currentTarget, e.clientX, e.clientY));
  }} onPointerCancel={() => { drag.current = null; setPreview(null); }} onPointerUp={(e) => {
    if (disabled) return;
    if (areaMode) {
      if (drag.current?.pointer !== e.pointerId) return;
      const highlight = highlightAt(e.currentTarget, e.clientX, e.clientY);
      drag.current = null; setPreview(null);
      if (highlight) onArea(highlight);
    } else {
      const bounds = e.currentTarget.getBoundingClientRect();
      onPick({ x: Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height)) }, e.currentTarget);
    }
  }}>
    {children}
    {preview ? <span className={`${styles.highlight} ${styles.highlightActive}`} style={{ left: `${preview.x * 100}%`, top: `${preview.y * 100}%`, width: `${preview.width * 100}%`, height: `${preview.height * 100}%` }} /> : null}
  </div>;
}

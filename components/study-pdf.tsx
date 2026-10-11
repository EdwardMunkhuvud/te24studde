"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import { EMPTY_ANCHOR, type NoteAnchor, type StudyNote } from "@/lib/study-types";
import { textHighlights } from "@/lib/study-highlights";
import { StudyAnnotations, StudyArea } from "./study-annotations";
import styles from "./study-hub.module.css";

export function StudyPdf({ url, page, onPage, onAnchor, marker, notes, onNote }: {
  url: string; page: number; onPage: (page: number) => void; onAnchor: (anchor: Partial<NoteAnchor>) => void;
  marker: (NoteAnchor & { id?: string }) | null; notes: StudyNote[]; onNote: (note: StudyNote) => void;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [width, setWidth] = useState(600);
  const [areaMode, setAreaMode] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false; let destroy: (() => void) | undefined;
    import("pdfjs-dist").then(async (pdfjs) => {
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = "/study/pdfjs/pdf.worker.min.mjs";
      const task = pdfjs.getDocument({ url, isEvalSupported: false, cMapUrl: "/study/pdfjs/cmaps/", cMapPacked: true,
        standardFontDataUrl: "/study/pdfjs/standard_fonts/", wasmUrl: "/study/pdfjs/wasm/" });
      destroy = () => { void task.destroy(); };
      const pdf = await task.promise;
      if (!disposed) setDocument(pdf);
    }).catch((reason) => { if (!disposed) { console.error("PDF reader:", reason); setError("PDF-filen kunde inte öppnas. Du kan fortfarande ladda ner den och skriva en anteckning med sidnummer."); setLoading(false); } });
    return () => { disposed = true; destroy?.(); };
  }, [url]);
  useEffect(() => {
    const element = wrapper.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(180, entry.contentRect.width)));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document) return;
    let disposed = false; let cancel: (() => void) | undefined;
    setLoading(true); setError("");
    (async () => {
      const current = await document.getPage(Math.min(page, document.numPages));
      if (disposed || !canvas.current || !text.current) return;
      const viewport = current.getViewport({ scale: width / current.getViewport({ scale: 1 }).width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const target = canvas.current; target.width = Math.floor(viewport.width * ratio); target.height = Math.floor(viewport.height * ratio);
      target.style.width = `${viewport.width}px`; target.style.height = `${viewport.height}px`;
      text.current.replaceChildren();
      text.current.style.setProperty("--scale-factor", String(viewport.scale));
      text.current.style.setProperty("--total-scale-factor", String(viewport.scale * viewport.userUnit));
      const pdfjs = await import("pdfjs-dist");
      if (disposed) return;
      const textContent = await current.getTextContent();
      if (disposed || !text.current) return;
      const layer = new pdfjs.TextLayer({ textContentSource: textContent, container: text.current, viewport });
      const task = current.render({ canvas: target, canvasContext: target.getContext("2d")!, viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      cancel = () => { task.cancel(); layer.cancel(); };
      await Promise.all([task.promise, layer.render()]);
      if (!disposed) setLoading(false);
    })().catch(() => { if (!disposed) { setError("Sidan kunde inte visas. Försök med en annan sida eller ladda ner filen."); setLoading(false); } });
    return () => { disposed = true; cancel?.(); };
  }, [document, page, width]);
  return <div className={styles.pdfViewer}>
    <div className={styles.viewerToolbar}>
      <button className="button button-secondary" aria-label="Föregående PDF-sida" disabled={page <= 1} onClick={() => onPage(page - 1)}>←</button>
      <label>Sida <input aria-label="PDF-sida" type="number" min={1} max={document?.numPages ?? 100000} value={page} onChange={(e) => {
        const value = Number(e.target.value); if (value >= 1 && value <= (document?.numPages ?? 100000)) onPage(value);
      }} /> av {document?.numPages ?? "…"}</label>
      <button className="button button-secondary" aria-label="Nästa PDF-sida" disabled={!document || page >= document.numPages} onClick={() => onPage(page + 1)}>→</button>
    </div>
    <div className={styles.selectionTools}><button className="button button-secondary" aria-pressed={areaMode} onClick={() => setAreaMode(!areaMode)}>{areaMode ? "Avsluta områdesmarkering" : "Markera område"}</button>
      <span className={styles.subtle}>{areaMode ? "Dra en ruta runt det du vill anteckna om." : "Markera text för överstrykning, eller tryck på en plats."}</span></div>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {loading ? <p role="status" className={styles.subtle}>Öppnar sida…</p> : null}
    <div ref={wrapper}>
    <StudyArea className={styles.pdfPage} areaMode={areaMode} disabled={loading || Boolean(error)} onArea={(highlight) => {
      onAnchor({ ...EMPTY_ANCHOR, page, highlights: [highlight] });
    }} onPick={(point, element) => {
      const selection = window.getSelection();
      const quote = selection && text.current?.contains(selection.anchorNode) && text.current?.contains(selection.focusNode) ? selection.toString().trim().slice(0, 1000) : "";
      const highlights = quote && selection?.rangeCount ? textHighlights(Array.from(selection.getRangeAt(0).getClientRects()), element.getBoundingClientRect()) : [];
      onAnchor({ ...EMPTY_ANCHOR, page, quote, highlights, ...(highlights.length ? {} : point) });
    }}>
      <canvas ref={canvas} aria-label={`PDF sida ${page}`} />
      <div ref={text} className="textLayer" />
      <StudyAnnotations notes={notes.filter((note) => note.page === page)} draft={marker} activeId={marker?.id} onNote={onNote} />
    </StudyArea>
    </div>
  </div>;
}

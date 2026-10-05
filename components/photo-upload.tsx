"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from "react";
import { Check, ImagePlus, Upload, X } from "lucide-react";
import { MAX_PHOTO_BYTES, PHOTO_ACCEPT, type PhotoItem } from "@/lib/photo-types";

type QueuedPhoto = { file: File; preview: string; error: string };
type Props = { scope: "GALLERY" | "ATTACHMENT"; enabled: boolean; remaining?: number; onUploaded: (photo: PhotoItem) => void; onBusyChange?: (busy: boolean) => void; onPendingChange?: (pending: boolean) => void };

export function PhotoUpload({ scope, enabled, remaining = 20, onUploaded, onBusyChange, onPendingChange }: Props) {
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<XMLHttpRequest | null>(null);
  const mounted = useRef(true);
  const previews = useRef(new Set<string>());
  const id = useId();
  const isGallery = scope === "GALLERY";

  useEffect(() => {
    mounted.current = true;
    const previewUrls = previews.current;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => { onPendingChange?.(queue.length > 0); }, [queue.length, onPendingChange]);
  useEffect(() => {
    onBusyChange?.(busy);
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, onBusyChange]);

  function selectFiles(files: FileList | File[]) {
    setError(""); setStatus("");
    const selected = Array.from(files);
    if (input.current) input.current.value = "";
    const available = Math.max(0, Math.min(20, remaining) - queue.length);
    if (selected.length > available) { setError(`Du kan välja ${available} ${available === 1 ? "bild" : "bilder"} till.`); return; }
    if (selected.some((file) => !PHOTO_ACCEPT.split(",").includes(file.type) || !file.size || file.size > MAX_PHOTO_BYTES)) {
      setError("Välj JPG, PNG, WebP eller GIF, högst 25 MB per bild. Exportera HEIC som JPG först."); return;
    }
    setQueue((current) => [...current, ...selected.map((file) => {
      const preview = URL.createObjectURL(file); previews.current.add(preview);
      return { file, preview, error: "" };
    })]);
    if (input.current) input.current.value = "";
  }

  function send(file: File): Promise<PhotoItem> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest(); activeRequest.current = request;
      request.open("POST", "/api/student-photos");
      request.timeout = 120_000;
      request.setRequestHeader("Content-Type", file.type);
      request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
      request.setRequestHeader("X-Photo-Scope", scope);
      request.setRequestHeader("X-Photo-Caption", encodeURIComponent(caption));
      request.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
      request.onload = () => {
        try {
          const data = JSON.parse(request.responseText);
          if (request.status >= 200 && request.status < 300 && data.photo) resolve(data.photo);
          else reject(new Error(data.error || "Uppladdningen misslyckades."));
        } catch { reject(new Error("Uppladdningen misslyckades. Försök igen.")); }
      };
      request.onerror = () => reject(new Error("Anslutningen bröts. Försök igen."));
      request.ontimeout = () => reject(new Error("Uppladdningen tog för lång tid. Försök igen."));
      request.onabort = () => reject(new Error("Uppladdningen avbröts."));
      request.send(file);
    });
  }

  async function upload() {
    if (busy || !queue.length) return;
    setBusy(true); setError("");
    let saved = 0;
    const failed: QueuedPhoto[] = [];
    for (const [index, item] of queue.entries()) {
      if (!mounted.current) return;
      setStatus(`Laddar upp ${index + 1} av ${queue.length}: ${item.file.name}`); setProgress(0);
      try {
        const photo = await send(item.file);
        if (!mounted.current) return;
        onUploaded(photo); saved += 1;
        URL.revokeObjectURL(item.preview); previews.current.delete(item.preview);
      } catch (uploadError) {
        failed.push({ ...item, error: uploadError instanceof Error ? uploadError.message : "Försök igen." });
      }
    }
    if (!mounted.current) return;
    activeRequest.current = null;
    setQueue(failed); setBusy(false); setProgress(0);
    setStatus(saved ? `${saved} ${saved === 1 ? "bild uppladdad" : "bilder uppladdade"}${isGallery ? " till klassens album" : ". Spara inlägget för att publicera"}.` : "");
    if (failed.length) setError("Några bilder kunde inte laddas upp. Lyckade uppladdningar är sparade; försök igen med resten.");
    else setCaption("");
  }

  if (!enabled) return <p className="info-callout small-text">Bildlagringen är inte ansluten ännu. Edvin behöver ansluta den innan ni kan ladda upp bilder.</p>;
  return <div className="photo-upload">
    <label className="photo-dropzone" htmlFor={id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy) selectFiles(event.dataTransfer.files); }}>
      <ImagePlus size={26} aria-hidden="true" /><strong>{isGallery ? "Välj bilder till studentalbumet" : "Lägg till bilder i inlägget"}</strong>
      <span className="small-text">Välj från mobilen eller dra hit bilder · JPG, PNG, WebP, GIF · max 25 MB</span>
      <input ref={input} id={id} accept={PHOTO_ACCEPT} type="file" multiple disabled={busy || remaining === 0} onChange={(event) => { if (event.target.files) selectFiles(event.target.files); }} />
    </label>
    {queue.length > 0 ? <>
      <ul className="photo-queue">{queue.map((item) => <li key={item.preview}><img src={item.preview} alt="" /><div><strong>{item.file.name}</strong><span className="small-text">{(item.file.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB</span>{item.error ? <span className="photo-error">{item.error}</span> : null}</div><button aria-label={`Ta bort ${item.file.name} från urvalet`} disabled={busy} type="button" className="photo-icon-button" onClick={() => { URL.revokeObjectURL(item.preview); previews.current.delete(item.preview); setQueue(queue.filter((photo) => photo.preview !== item.preview)); }}><X size={18} /></button></li>)}</ul>
      {isGallery ? <label className="field"><span>Bildtext (valfri, samma för de valda bilderna)</span><input maxLength={200} value={caption} disabled={busy} onChange={(event) => setCaption(event.target.value)} placeholder="Till exempel: sista klassresan ✨" /></label> : null}
      <button className="button button-primary" type="button" disabled={busy} onClick={upload}><Upload size={18} aria-hidden="true" />{busy ? "Laddar upp…" : `Ladda upp ${queue.length} ${queue.length === 1 ? "bild" : "bilder"}`}</button>
    </> : null}
    {status ? <p className="small-text photo-upload-status" role="status">{!busy ? <Check size={18} aria-hidden="true" /> : null}{status}</p> : null}
    {busy ? <progress className="photo-progress" value={progress} max={100} aria-label="Uppladdning" /> : null}
    {error ? <p className="banner danger" role="alert">{error}</p> : null}
  </div>;
}

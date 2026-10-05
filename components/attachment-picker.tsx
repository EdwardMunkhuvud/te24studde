"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { MAX_ATTACHMENTS, type PhotoItem } from "@/lib/photo-types";
import { PhotoUpload } from "@/components/photo-upload";

export function AttachmentPicker({ initialPhotos = [], enabled }: { initialPhotos?: PhotoItem[]; enabled: boolean }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = root.current?.closest("form");
    const block = (event: Event) => { if (busy || pending) { event.preventDefault(); event.stopPropagation(); setBlocked(true); } };
    form?.addEventListener("submit", block, true);
    return () => form?.removeEventListener("submit", block, true);
  }, [busy, pending]);
  return <div className="attachment-picker" ref={root}>
    <div className="attachment-heading"><strong>Bilder i inlägget</strong><span className="small-text">{photos.length} / {MAX_ATTACHMENTS} · valfritt</span></div>
    <div className="attachment-previews">{photos.map((photo) => <div key={photo.id}><input type="hidden" name="photoIds" value={photo.id} /><img src={photo.thumbnailHref} alt={photo.fileName} /><button type="button" className="photo-icon-button" disabled={busy} aria-label={`Ta bort ${photo.fileName} från inlägget`} onClick={() => setPhotos(photos.filter((item) => item.id !== photo.id))}><X size={16} /></button></div>)}</div>
    <div hidden={photos.length === MAX_ATTACHMENTS && !busy && !pending}><PhotoUpload scope="ATTACHMENT" enabled={enabled} remaining={MAX_ATTACHMENTS - photos.length} onBusyChange={setBusy} onPendingChange={setPending} onUploaded={(photo) => setPhotos((current) => [...current, photo])} /></div>
    <p className="small-text">Bilderna visas med inlägget när du sparar. De läggs inte i studentalbumet. Borttagna bilder försvinner från inlägget först när du sparar.</p>
    {blocked && (busy || pending) ? <p className="photo-error" role="alert">Ladda upp de valda bilderna (eller ta bort dem ur urvalet) innan du sparar.</p> : null}
  </div>;
}

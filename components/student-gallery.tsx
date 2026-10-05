"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PhotoItem, PhotoPage } from "@/lib/photo-types";
import { PhotoUpload } from "@/components/photo-upload";
import { PhotoLightbox } from "@/components/photo-lightbox";

export function StudentGallery({ initialPage, userId, admin, enabled }: { initialPage: PhotoPage; userId: string; admin: boolean; enabled: boolean }) {
  const [page, setPage] = useState(initialPage);
  const [mine, setMine] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const requestId = useRef(0);
  const upload = useRef<HTMLDetailsElement>(null);
  const router = useRouter();

  async function load(onlyMine: boolean, more = false) {
    const currentRequest = ++requestId.current;
    setLoading(true); setError(""); setIndex(null); setConfirmId(null);
    try {
      const query = new URLSearchParams();
      if (onlyMine) query.set("mine", "1");
      if (more && page.nextCursor) query.set("cursor", page.nextCursor);
      const response = await fetch(`/api/student-photos?${query}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (currentRequest !== requestId.current) return;
      setPage((previous) => ({ ...result, photos: more ? [...previous.photos, ...result.photos].filter((photo, position, all) => all.findIndex((item) => item.id === photo.id) === position) : result.photos }));
      setMine(onlyMine);
    } catch (loadError) { if (currentRequest === requestId.current) setError(loadError instanceof Error ? loadError.message : "Bilderna kunde inte hämtas."); }
    finally { if (currentRequest === requestId.current) setLoading(false); }
  }

  async function remove(photo: PhotoItem) {
    setDeleting(true); setError("");
    try {
      const response = await fetch(`/api/student-photos/${photo.id}`, { method: "DELETE" });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error); }
      setPage((previous) => ({ ...previous, photos: previous.photos.filter((item) => item.id !== photo.id), total: Math.max(0, previous.total - 1), nextCursor: previous.nextCursor === photo.id ? previous.photos.filter((item) => item.id !== photo.id).at(-1)?.id ?? null : previous.nextCursor }));
      setConfirmId(null); router.refresh();
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Bilden kunde inte tas bort."); }
    finally { setDeleting(false); }
  }

  return <section className="student-gallery">
    <div className="album-header"><div><span className="eyebrow">Våra minnen</span><h2>Bilder till studenten</h2><p className="panel-subtle">Klassresor, vardag och allt däremellan. Samla bilderna här så hittar hela klassen dem.</p></div><button className="button button-primary" type="button" onClick={() => { if (upload.current) { upload.current.open = true; upload.current.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); upload.current.querySelector<HTMLInputElement>('input[type="file"]')?.focus(); } }}><ImagePlus size={20} aria-hidden="true" />Lägg upp bilder</button></div>
    <details className="panel album-upload-panel" ref={upload}><summary><ImagePlus size={20} aria-hidden="true" />Ladda upp till klassens album<span className="small-text">Ditt namn följer med automatiskt</span></summary><PhotoUpload scope="GALLERY" enabled={enabled} onBusyChange={setUploading} onUploaded={(photo) => { setPage((previous) => ({ ...previous, photos: [photo, ...previous.photos], total: previous.total + 1 })); }} /></details>
    <div className="album-toolbar"><div className="album-filters" aria-label="Filtrera bilder"><button type="button" aria-pressed={!mine} disabled={loading || uploading} onClick={() => load(false)}>Alla bilder</button><button type="button" aria-pressed={mine} disabled={loading || uploading} onClick={() => load(true)}>Mina bilder</button></div><span className="small-text" role="status">{loading ? "Hämtar bilder…" : `${page.total} ${page.total === 1 ? "bild" : "bilder"}${mine ? " från dig" : " i albumet"}`}</span></div>
    {error ? <p className="banner danger" role="alert">{error}</p> : null}
    {!page.photos.length ? <div className="album-empty"><Camera size={44} aria-hidden="true" /><h3>{mine ? "Dina minnen börjar här" : "Första minnet väntar på er"}</h3><p>{mine ? "Lägg upp din första bild och dela den med klassen." : "Har du en bild som borde vara med till studenten? Bli först med att lägga upp den."}</p><span className="small-text">Bilderna syns för alla inloggade i klassen.</span></div> : <div className="album-grid">{page.photos.map((photo, position) => <article className="album-card" key={photo.id}><button type="button" className="album-image" onClick={() => setIndex(position)} aria-label={`Visa bild: ${photo.caption || photo.fileName}`}><img src={photo.thumbnailHref} alt={photo.caption || photo.fileName} loading="lazy" /></button><div className="album-card-body">{photo.caption ? <p>{photo.caption}</p> : null}<div className="album-credit"><span className="album-avatar" aria-hidden="true">{photo.uploaderName.charAt(0)}</span><div><strong>{photo.uploaderName}{photo.userId === userId ? " · du" : ""}</strong><span>{new Intl.DateTimeFormat("sv-SE", {dateStyle:"medium", timeZone:"Europe/Stockholm"}).format(new Date(photo.createdAt))}</span></div>{admin || photo.userId === userId ? <button type="button" className="photo-icon-button" aria-label={`Ta bort bild: ${photo.caption || photo.fileName}`} onClick={() => setConfirmId(photo.id)}><Trash2 size={17} /></button> : null}</div>{confirmId === photo.id ? <div className="delete-confirm"><p>Ta bort bilden från albumet? Det går inte att ångra.</p><div className="inline-actions"><button disabled={deleting} type="button" className="button button-danger" onClick={() => remove(photo)}>{deleting ? "Tar bort…" : "Ja, ta bort"}</button><button disabled={deleting} type="button" className="button button-secondary" onClick={() => setConfirmId(null)}>Avbryt</button></div></div> : null}</div></article>)}</div>}
    {page.nextCursor ? <button className="button button-secondary album-load-more" disabled={loading || uploading} type="button" onClick={() => load(mine, true)}>{loading ? "Hämtar…" : "Visa fler bilder"}</button> : null}
    {index !== null ? <PhotoLightbox photos={page.photos} index={index} onIndex={setIndex} onClose={() => setIndex(null)} /> : null}
  </section>;
}

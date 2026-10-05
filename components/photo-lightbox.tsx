"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import type { PhotoItem } from "@/lib/photo-types";

export function PhotoLightbox({ photos, index, onIndex, onClose }: { photos: PhotoItem[]; index: number; onIndex: (index: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const photo = photos[index];
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = originalOverflow; previous?.focus(); };
  }, []);
  if (!photo) return null;
  return <dialog ref={dialog} className="photo-lightbox" aria-label={photo.caption || photo.fileName} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={(event) => {
    if (event.key === "ArrowLeft" && index > 0) { event.preventDefault(); onIndex(index - 1); }
    if (event.key === "ArrowRight" && index < photos.length - 1) { event.preventDefault(); onIndex(index + 1); }
  }}>
    <div className="photo-lightbox-toolbar"><span aria-live="polite">{index + 1} / {photos.length}</span><a className="photo-icon-button" href={`${photo.href}?download=1`} aria-label="Ladda ned originalbild"><Download size={22} /></a><button autoFocus className="photo-icon-button" type="button" aria-label="Stäng bild" onClick={onClose}><X size={24} /></button></div>
    <div className="photo-lightbox-stage"><button className="photo-icon-button photo-previous" type="button" disabled={index === 0} aria-label="Föregående bild" onClick={() => onIndex(index - 1)}><ChevronLeft size={28} /></button><img key={photo.id} src={photo.href} alt={photo.caption || photo.fileName} /><button className="photo-icon-button photo-next" type="button" disabled={index === photos.length - 1} aria-label="Nästa bild" onClick={() => onIndex(index + 1)}><ChevronRight size={28} /></button></div>
    <div className="photo-lightbox-caption"><strong>{photo.caption || photo.fileName}</strong><span className="small-text">Uppladdad av {photo.uploaderName} · {new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeZone: "Europe/Stockholm" }).format(new Date(photo.createdAt))}</span></div>
  </dialog>;
}

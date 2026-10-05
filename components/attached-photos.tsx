"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { PhotoItem } from "@/lib/photo-types";
import { PhotoLightbox } from "@/components/photo-lightbox";

export function AttachedPhotos({ photos }: { photos: PhotoItem[] }) {
  const [index, setIndex] = useState<number | null>(null);
  if (!photos.length) return null;
  return <>
    <div className={`attached-photos ${photos.length === 1 ? "attached-single" : ""}`}>{photos.map((photo, position) => <button key={photo.id} type="button" onClick={() => setIndex(position)} aria-label={`Visa bild: ${photo.caption || photo.fileName}`}><img src={photo.thumbnailHref} alt={photo.caption || photo.fileName} loading="lazy" /></button>)}</div>
    {index !== null ? <PhotoLightbox photos={photos} index={index} onIndex={setIndex} onClose={() => setIndex(null)} /> : null}
  </>;
}

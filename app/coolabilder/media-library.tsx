"use client";

/* eslint-disable @next/next/no-img-element */

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Images,
  LockKeyhole,
  Shuffle,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, PointerEvent, TransitionEvent, useEffect, useMemo, useRef, useState } from "react";

import type { MediaItem } from "./page";
import { SaveToLibraryButton } from "./save-to-library-button";
import { UploadMediaButton } from "./upload-media-button";
import styles from "./coolabilder.module.css";

type MediaGroup = {
  dateKey: string;
  dateLabel: string;
  items: MediaItem[];
};

type Props = {
  initialGroups: MediaGroup[];
  initialMedia: MediaItem[];
};

export function MediaLibrary({ initialGroups, initialMedia }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"gallery" | "memories">("gallery");
  const [selectedDate, setSelectedDate] = useState("all");
  const [media, setMedia] = useState(initialMedia);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [password, setPassword] = useState("");
  const [manageError, setManageError] = useState("");
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [leavingMemory, setLeavingMemory] = useState<MediaItem | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<-1 | 0 | 1>(0);
  const dragStartX = useRef(0);
  const isDragging = useRef(false);

  const dates = useMemo(() => initialGroups
    .filter((group) => media.some((item) => item.dateKey === group.dateKey))
    .map(({ dateKey, dateLabel }) => ({ dateKey, dateLabel })), [initialGroups, media]);
  const visibleMedia = selectedDate === "all" ? media : media.filter((item) => item.dateKey === selectedDate);
  const visibleGroups = dates
    .filter(({ dateKey }) => selectedDate === "all" || dateKey === selectedDate)
    .map(({ dateKey, dateLabel }) => ({
      dateKey,
      dateLabel,
      items: visibleMedia.filter((item) => item.dateKey === dateKey),
    }));
  const currentMemory = media[currentIndex] ?? null;

  useEffect(() => {
    if (initialMedia.length > 1) {
      setCurrentIndex(Math.floor(Math.random() * initialMedia.length));
    }
  }, [initialMedia.length]); // Start on a different memory each visit.

  useEffect(() => {
    if (currentIndex >= media.length) {
      setCurrentIndex(Math.max(0, media.length - 1));
    }
  }, [currentIndex, media.length]);

  useEffect(() => {
    if (exitDirection === 0) {
      return;
    }

    const fallback = window.setTimeout(() => {
      setLeavingMemory(null);
      setDragX(0);
      setExitDirection(0);
    }, 320);

    return () => window.clearTimeout(fallback);
  }, [exitDirection, media.length]);

  async function unlockManagement(event: FormEvent) {
    event.preventDefault();
    setCheckingPassword(true);
    setManageError("");

    try {
      const response = await fetch("/coolabilder/delete", {
        headers: { "X-Upload-Password": password },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Fel kod.");
      }

      setManageMode(true);
      setManageOpen(false);
      setActiveTab("gallery");
    } catch (error) {
      setManageError(error instanceof Error ? error.message : "Kunde inte låsa upp.");
    } finally {
      setCheckingPassword(false);
    }
  }

  async function deleteItem(item: MediaItem) {
    if (!item.r2Key || !window.confirm(`Ta bort ${item.name} permanent?`)) {
      return;
    }

    setDeletingKey(item.r2Key);

    try {
      const response = await fetch("/coolabilder/delete", {
        headers: {
          "X-Media-Key": encodeURIComponent(item.r2Key),
          "X-Upload-Password": password,
        },
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: "Raderingen misslyckades." }));
        throw new Error(result.error || "Raderingen misslyckades.");
      }

      setMedia((items) => items.filter((candidate) => candidate.r2Key !== item.r2Key));
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Raderingen misslyckades.");
    } finally {
      setDeletingKey(null);
    }
  }

  function showNextMemory(direction: -1 | 1) {
    if (!currentMemory || exitDirection !== 0) {
      return;
    }

    setLeavingMemory(currentMemory);
    setCurrentIndex((previous) => pickRandomIndex(media.length, previous));
    setExitDirection(direction);
  }

  function handleCardTransitionEnd(event: TransitionEvent<HTMLElement>) {
    if (event.propertyName !== "transform" || exitDirection === 0) {
      return;
    }

    setLeavingMemory(null);
    setDragX(0);
    setExitDirection(0);
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartX.current = event.clientX;
    isDragging.current = true;
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (isDragging.current) {
      setDragX(event.clientX - dragStartX.current);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const distance = event.clientX - dragStartX.current;
    isDragging.current = false;
    setDragging(false);

    if (Math.abs(distance) >= 70) {
      showNextMemory(distance < 0 ? -1 : 1);
    } else {
      setDragX(0);
    }
  }

  const cardX = exitDirection ? exitDirection * 130 : dragX;
  const memoryStyle = {
    opacity: exitDirection ? 0 : 1,
    transform: `translateX(${cardX}%) rotate(${cardX / 18}deg)`,
    transition: dragging ? "none" : "transform 260ms cubic-bezier(.2,.8,.2,1), opacity 220ms ease",
  };

  return (
    <>
      {media.length > 0 ? (
        <nav aria-label="Vy" className={styles.viewTabs}>
          <button className={activeTab === "gallery" ? styles.viewTabActive : styles.viewTab} onClick={() => setActiveTab("gallery")} type="button">
            <Images aria-hidden="true" size={18} />
            Galleri
          </button>
          <button className={activeTab === "memories" ? styles.viewTabActive : styles.viewTab} onClick={() => setActiveTab("memories")} type="button">
            <Sparkles aria-hidden="true" size={18} />
            Minnen
          </button>
        </nav>
      ) : null}

      {media.length === 0 ? (
        <section className={styles.empty}>
          <strong>Inga medier än.</strong>
          <span>Använd knappen längst ner för att lägga till bilder och videor.</span>
        </section>
      ) : activeTab === "gallery" ? (
        <>
          <div className={styles.filterBar}>
            <CalendarDays aria-hidden="true" size={20} />
            <label htmlFor="date-filter">Visa datum</label>
            <select id="date-filter" onChange={(event) => setSelectedDate(event.target.value)} value={selectedDate}>
              <option value="all">Alla datum ({media.length} filer)</option>
              {dates.map(({ dateKey, dateLabel }) => (
                <option key={dateKey} value={dateKey}>
                  {dateLabel} ({media.filter((item) => item.dateKey === dateKey).length})
                </option>
              ))}
            </select>
          </div>

          {manageMode ? (
            <div className={styles.manageNotice}>
              <Trash2 aria-hidden="true" size={18} />
              <span>Raderingsläge är aktivt</span>
              <button onClick={() => { setManageMode(false); setPassword(""); }} type="button">Klar</button>
            </div>
          ) : null}

          {visibleGroups.map((group) => {
            const groupImageCount = group.items.filter((item) => item.kind === "Bild").length;
            const groupShareFiles = group.items.map(({ kind, name, shareHref }) => ({ href: shareHref, kind, name }));

            return (
              <section className={styles.dateGroup} key={group.dateKey}>
                <div className={styles.dateHeading}>
                  <h2>{group.dateLabel}</h2>
                  <div className={styles.dateActions}>
                    <span>{group.items.length} filer</span>
                    <SaveToLibraryButton files={groupShareFiles} label={`Spara ${group.items.length} i Bilder`} />
                    {groupImageCount > 0 ? (
                      <a className={styles.groupDownload} href={`/coolabilder/download/${group.dateKey}`} download>
                        ZIP: {groupImageCount} bilder
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className={styles.grid}>
                  {group.items.map((item) => (
                    <article className={styles.card} key={item.href}>
                      <a className={styles.mediaLink} href={item.href}>
                        {item.kind === "Bild" ? (
                          <img className={styles.preview} src={item.href} alt={item.name} loading="lazy" />
                        ) : (
                          <div className={styles.videoWrap}>
                            <video preload="metadata" src={item.href} muted playsInline />
                            <span className={styles.typeBadge}>Video</span>
                          </div>
                        )}
                      </a>
                      <div className={styles.meta}>
                        <span className={styles.name} title={item.name}>{item.name}</span>
                        <div className={styles.details}><span>{item.kind}</span><span>{item.sizeLabel}</span></div>
                        {manageMode && item.r2Key ? (
                          <button className={styles.deleteButton} disabled={deletingKey === item.r2Key} onClick={() => deleteItem(item)} type="button">
                            <Trash2 aria-hidden="true" size={17} />
                            {deletingKey === item.r2Key ? "Tar bort..." : "Ta bort"}
                          </button>
                        ) : (
                          <>
                            <a className={styles.download} href={item.href} download>Ladda ner</a>
                            <SaveToLibraryButton files={[{ href: item.shareHref, kind: item.kind, name: item.name }]} label="Spara i Bilder" />
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      ) : (
        <section className={styles.memories}>
          <div className={styles.memoriesHeading}>
            <span>Slumpmässigt ur biblioteket</span>
            <h2>Ett minne i taget</h2>
            <p>Swipa åt valfritt håll för nästa.</p>
          </div>
          {currentMemory ? (
            <div className={styles.swipeStage}>
              {leavingMemory ? (
                <article aria-hidden="true" className={styles.memoryCardBehind}>
                  <MemoryContent item={currentMemory} />
                </article>
              ) : null}
              <article
                className={styles.memoryCard}
                onPointerCancel={handlePointerUp}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onTransitionEnd={handleCardTransitionEnd}
                style={memoryStyle}
              >
                <MemoryContent item={leavingMemory ?? currentMemory} />
              </article>
            </div>
          ) : null}
          <div className={styles.swipeActions}>
            <button aria-label="Nästa minne åt vänster" onClick={() => showNextMemory(-1)} type="button"><ChevronLeft size={25} /></button>
            <span><Shuffle size={17} /> Swipa</span>
            <button aria-label="Nästa minne åt höger" onClick={() => showNextMemory(1)} type="button"><ChevronRight size={25} /></button>
          </div>
        </section>
      )}

      <footer className={styles.uploadFooter}>
        <UploadMediaButton />
        <button className={styles.manageTrigger} onClick={() => setManageOpen(true)} type="button">Hantera</button>
      </footer>

      {manageOpen ? (
        <div className={styles.uploadBackdrop} onMouseDown={() => setManageOpen(false)}>
          <form
            aria-label="Hantera biblioteket"
            aria-modal="true"
            className={styles.manageDialog}
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={unlockManagement}
            role="dialog"
          >
            <button aria-label="Stäng" className={styles.uploadClose} onClick={() => setManageOpen(false)} type="button"><X size={20} /></button>
            <LockKeyhole aria-hidden="true" className={styles.manageLock} size={26} />
            <h2>Hantera biblioteket</h2>
            <p>Skriv samma kod som vid uppladdning för att visa raderingsknapparna.</p>
            <label className={styles.uploadField}>
              <span>Kod</span>
              <input autoFocus inputMode="numeric" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
            </label>
            {manageError ? <p className={styles.uploadError}>{manageError}</p> : null}
            <button className={styles.uploadSubmit} disabled={checkingPassword || !password} type="submit">
              {checkingPassword ? "Kontrollerar..." : "Lås upp"}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

function MemoryContent({ item }: { item: MediaItem }) {
  return (
    <>
      {item.kind === "Bild" ? (
        <img draggable="false" src={item.href} alt={item.name} />
      ) : (
        <video controls playsInline preload="metadata" src={item.href} />
      )}
      <div className={styles.memoryCaption}>
        <span>{item.dateLabel}</span>
        <strong>{item.name}</strong>
      </div>
    </>
  );
}

function pickRandomIndex(length: number, previous: number) {
  if (length <= 1) {
    return 0;
  }

  const candidate = Math.floor(Math.random() * (length - 1));
  return candidate >= previous ? candidate + 1 : candidate;
}

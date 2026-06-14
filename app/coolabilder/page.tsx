/* eslint-disable @next/next/no-img-element */
import { readdir, stat } from "fs/promises";
import path from "path";

import styles from "./coolabilder.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MediaItem = {
  dateKey: string;
  dateLabel: string;
  href: string;
  kind: "Bild" | "Video";
  name: string;
  sizeLabel: string;
  timestamp: number;
};

const mediaDirectory = path.join(process.cwd(), "public", "coolabilder-media");
const publicBasePath = "/coolabilder-media";
const supportedImages = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const supportedVideos = new Set([".mp4", ".mov", ".m4v", ".webm"]);

async function getMediaFiles(directory: string, relativeDirectory = ""): Promise<MediaItem[]> {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const items = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.join(relativeDirectory, entry.name);

      if (entry.isDirectory()) {
        return getMediaFiles(absolutePath, relativePath);
      }

      const extension = path.extname(entry.name).toLowerCase();
      const isImage = supportedImages.has(extension);
      const isVideo = supportedVideos.has(extension);

      if (!isImage && !isVideo) {
        return [];
      }

      const fileStat = await stat(absolutePath);
      const timestamp = getBestTimestamp(entry.name, fileStat.mtime.getTime());
      const date = new Date(timestamp);
      const href = `${publicBasePath}/${relativePath.replaceAll(path.sep, "/")}`;

      const item: MediaItem = {
        dateKey: toDateKey(date),
        dateLabel: formatDate(date),
        href,
        kind: isImage ? "Bild" : "Video",
        name: entry.name,
        sizeLabel: formatSize(fileStat.size),
        timestamp,
      };

      return [
        item,
      ];
    }),
  );

  return items.flat();
}

function getBestTimestamp(fileName: string, fallback: number) {
  const dateMatch =
    fileName.match(/(20\d{2})[-_. ]?([01]\d)[-_. ]?([0-3]\d)/) ??
    fileName.match(/([0-3]\d)[-_. ]([01]\d)[-_. ](20\d{2})/);

  if (!dateMatch) {
    return fallback;
  }

  const [, first, second, third] = dateMatch;
  const year = first.length === 4 ? first : third;
  const month = second;
  const day = first.length === 4 ? third : first;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day)).getTime();

  return Number.isNaN(parsed) ? fallback : parsed;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function groupByDate(items: MediaItem[]) {
  const groups = new Map<string, MediaItem[]>();

  items.forEach((item) => {
    const group = groups.get(item.dateKey) ?? [];
    group.push(item);
    groups.set(item.dateKey, group);
  });

  return Array.from(groups.entries()).map(([dateKey, groupItems]) => ({
    dateKey,
    dateLabel: groupItems[0]?.dateLabel ?? dateKey,
    items: groupItems.sort((a, b) => b.timestamp - a.timestamp),
  }));
}

export default async function CoolaBilderPage() {
  const media = (await getMediaFiles(mediaDirectory)).sort((a, b) => b.timestamp - a.timestamp);
  const groups = groupByDate(media);
  const imageCount = media.filter((item) => item.kind === "Bild").length;
  const videoCount = media.filter((item) => item.kind === "Video").length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Hemligt resebibliotek</span>
          <h1>Coola bilder</h1>
          <p>
            Ett enkelt mediebibliotek för resor, sorterat efter datum. Lägg bilder och videor i
            mappen, så dyker de upp här automatiskt.
          </p>
          <div className={styles.summary}>
            <span className={styles.pill}>{media.length} filer</span>
            <span className={styles.pill}>{imageCount} bilder</span>
            <span className={styles.pill}>{videoCount} videor</span>
          </div>
        </section>

        {media.length === 0 ? (
          <section className={styles.empty}>
            <strong>Inga medier än.</strong>
            <span>Lägg filer i public/coolabilder-media och ladda om sidan.</span>
          </section>
        ) : (
          groups.map((group) => (
            <section className={styles.dateGroup} key={group.dateKey}>
              <div className={styles.dateHeading}>
                <h2>{group.dateLabel}</h2>
                <span>{group.items.length} filer</span>
              </div>
              <div className={styles.grid}>
                {group.items.map((item) => (
                  <article className={styles.card} key={item.href}>
                    <a className={styles.mediaLink} href={item.href} target="_blank" rel="noreferrer">
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
                      <span className={styles.name} title={item.name}>
                        {item.name}
                      </span>
                      <div className={styles.details}>
                        <span>{item.kind}</span>
                        <span>{item.sizeLabel}</span>
                      </div>
                      <a className={styles.download} href={item.href} download>
                        Ladda ner
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}

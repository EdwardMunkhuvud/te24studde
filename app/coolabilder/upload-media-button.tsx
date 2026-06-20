"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./coolabilder.module.css";

export function UploadMediaButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [dateOverride, setDateOverride] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function upload() {
    if (!password || files.length === 0) {
      setError("Välj filer och skriv uppladdningslösenordet.");
      return;
    }

    setError("");
    setIsUploading(true);

    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Laddar upp ${index + 1} av ${files.length}: ${file.name}`);

        const response = await fetch("/coolabilder/upload", {
          body: file,
          headers: {
            "Content-Type": file.type || getMimeType(file.name),
            "X-File-Date": dateOverride || getLocalDate(file.lastModified),
            "X-File-Last-Modified": String(file.lastModified || Date.now()),
            "X-File-Name": encodeURIComponent(file.name),
            "X-File-Size": String(file.size),
            "X-Upload-Password": password,
          },
          method: "POST",
        });

        if (!response.ok) {
          const result = await response.json().catch(() => ({ error: "Uppladdningen misslyckades." }));
          throw new Error(result.error || "Uppladdningen misslyckades.");
        }
      }

      setProgress(`${files.length} filer uppladdade.`);
      setFiles([]);
      router.refresh();
      window.setTimeout(() => {
        setIsOpen(false);
        setProgress("");
      }, 900);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Uppladdningen misslyckades.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <>
      <button className={styles.uploadTrigger} onClick={() => setIsOpen(true)} type="button">
        Lägg till media
      </button>

      {isOpen ? (
        <div className={styles.uploadBackdrop} onMouseDown={() => !isUploading && setIsOpen(false)}>
          <section
            aria-label="Ladda upp bilder och videor"
            aria-modal="true"
            className={styles.uploadDialog}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className={styles.uploadHeading}>
              <div>
                <span className={styles.uploadEyebrow}>Till R2</span>
                <h2>Lägg till media</h2>
              </div>
              <button
                aria-label="Stäng"
                className={styles.uploadClose}
                disabled={isUploading}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <label className={styles.uploadField}>
              <span>Bilder och videor</span>
              <input
                accept="image/*,video/*"
                disabled={isUploading}
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                type="file"
              />
            </label>

            <label className={styles.uploadField}>
              <span>Datum för alla filer, valfritt</span>
              <input
                disabled={isUploading}
                onChange={(event) => setDateOverride(event.target.value)}
                type="date"
                value={dateOverride}
              />
            </label>

            <label className={styles.uploadField}>
              <span>Uppladdningslösenord</span>
              <input
                autoComplete="off"
                disabled={isUploading}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>

            {files.length > 0 ? <p className={styles.uploadSelection}>{files.length} filer valda</p> : null}
            {progress ? <p className={styles.uploadProgress}>{progress}</p> : null}
            {error ? <p className={styles.uploadError}>{error}</p> : null}

            <button className={styles.uploadSubmit} disabled={isUploading} onClick={upload} type="button">
              {isUploading ? "Laddar upp..." : "Ladda upp till biblioteket"}
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}

function getLocalDate(timestamp: number) {
  const date = new Date(timestamp || Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    m4v: "video/x-m4v",
    mov: "video/quicktime",
    mp4: "video/mp4",
    png: "image/png",
    webm: "video/webm",
    webp: "image/webp",
  };

  return types[extension ?? ""] ?? "application/octet-stream";
}

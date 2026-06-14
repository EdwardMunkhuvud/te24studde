"use client";

import { useState } from "react";

import styles from "./coolabilder.module.css";

type ShareFile = {
  href: string;
  kind: "Bild" | "Video";
  name: string;
};

type NavigatorWithShare = Navigator & {
  canShare?: (data: ShareData) => boolean;
};

export function SaveToLibraryButton({
  files,
  label,
}: {
  files: ShareFile[];
  label: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "unsupported" | "error">("idle");

  async function shareFiles() {
    const shareNavigator = navigator as NavigatorWithShare;

    if (!shareNavigator.share) {
      setStatus("unsupported");
      return;
    }

    try {
      setStatus("loading");

      const shareFiles = await Promise.all(
        files.map(async (file) => {
          const response = await fetch(file.href);

          if (!response.ok) {
            throw new Error(`Kunde inte hämta ${file.name}`);
          }

          const blob = await response.blob();

          return new File([blob], file.name, {
            type: blob.type || getMimeType(file.name),
          });
        }),
      );
      const shareData: ShareData = {
        files: shareFiles,
        title: "Coola bilder",
      };

      if (shareNavigator.canShare && !shareNavigator.canShare(shareData)) {
        setStatus("unsupported");
        return;
      }

      await shareNavigator.share(shareData);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <span className={styles.shareWrap}>
      <button
        className={styles.librarySave}
        disabled={status === "loading"}
        onClick={shareFiles}
        type="button"
      >
        {status === "loading" ? "Förbereder..." : label}
      </button>
      {status === "unsupported" ? (
        <span className={styles.shareStatus}>Testa en fil i taget eller använd ZIP.</span>
      ) : null}
      {status === "error" ? (
        <span className={styles.shareStatus}>Kunde inte öppna delning. Testa ZIP.</span>
      ) : null}
    </span>
  );
}

function getMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "m4v":
      return "video/x-m4v";
    case "webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

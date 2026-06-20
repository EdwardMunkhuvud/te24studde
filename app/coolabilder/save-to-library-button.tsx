"use client";

import { useState } from "react";

import styles from "./coolabilder.module.css";

const maxBatchFiles = 12;
const maxBatchBytes = 60 * 1024 * 1024;

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
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "sharing" | "done" | "unsupported" | "error">("idle");
  const [preparedFiles, setPreparedFiles] = useState<File[]>([]);
  const [batchStart, setBatchStart] = useState(0);
  const [batchEnd, setBatchEnd] = useState(0);

  async function handleClick() {
    const shareNavigator = navigator as NavigatorWithShare;

    if (!shareNavigator.share) {
      setStatus("unsupported");
      return;
    }

    if (status === "ready") {
      sharePreparedBatch(shareNavigator);
      return;
    }

    if (status === "idle" || status === "error" || status === "done") {
      await prepareBatch(status === "done" ? 0 : batchStart);
    }
  }

  async function prepareBatch(start: number) {
    setStatus("loading");
    setPreparedFiles([]);

    try {
      const batch: File[] = [];
      let totalBytes = 0;
      let index = start;

      while (index < files.length && batch.length < maxBatchFiles) {
        const file = files[index];
        const response = await fetch(file.href);

        if (!response.ok) {
          throw new Error(`Kunde inte hämta ${file.name}`);
        }

        const blob = await response.blob();
        batch.push(new File([blob], file.name, {
          type: blob.type || getMimeType(file.name),
        }));
        totalBytes += blob.size;
        index += 1;

        if (totalBytes >= maxBatchBytes) {
          break;
        }
      }

      const shareNavigator = navigator as NavigatorWithShare;
      const shareData: ShareData = { files: batch, title: "Coola bilder" };

      if (shareNavigator.canShare && !shareNavigator.canShare(shareData)) {
        const singleFileData: ShareData = { files: batch.slice(0, 1), title: "Coola bilder" };

        if (!batch[0] || !shareNavigator.canShare(singleFileData)) {
          setStatus("unsupported");
          return;
        }

        setPreparedFiles(batch.slice(0, 1));
        setBatchStart(start);
        setBatchEnd(start + 1);
      } else {
        setPreparedFiles(batch);
        setBatchStart(start);
        setBatchEnd(index);
      }

      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  function sharePreparedBatch(shareNavigator: NavigatorWithShare) {
    const shareData: ShareData = {
      files: preparedFiles,
      title: "Coola bilder",
    };

    // Safari requires share() to be invoked synchronously from this fresh tap.
    let sharePromise: Promise<void>;

    try {
      sharePromise = shareNavigator.share!(shareData);
    } catch {
      setStatus("error");
      return;
    }

    setStatus("sharing");

    sharePromise.then(() => {
      setPreparedFiles([]);

      if (batchEnd < files.length) {
        void prepareBatch(batchEnd);
      } else {
        setBatchStart(0);
        setBatchEnd(0);
        setStatus("done");
      }
    }).catch((error: unknown) => {
      if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") {
        setStatus("ready");
      } else {
        setStatus("error");
      }
    });
  }

  const batchNumber = Math.floor(batchStart / maxBatchFiles) + 1;
  const approximateBatchCount = Math.ceil(files.length / maxBatchFiles);
  const buttonText = getButtonText(status, label, batchStart, batchEnd, files.length);

  return (
    <span className={styles.shareWrap}>
      <button
        className={styles.librarySave}
        disabled={status === "loading" || status === "sharing"}
        onClick={handleClick}
        type="button"
      >
        {buttonText}
      </button>
      {status === "ready" ? (
        <span className={styles.shareStatus}>
          {files.length > preparedFiles.length ? `Del ${batchNumber} av cirka ${approximateBatchCount}. ` : ""}
          Tryck igen för att öppna delning.
        </span>
      ) : null}
      {status === "done" ? (
        <span className={styles.shareStatus}>Alla filer är skickade till delningsmenyn.</span>
      ) : null}
      {status === "unsupported" ? (
        <span className={styles.shareStatus}>Testa en fil i taget eller använd ZIP.</span>
      ) : null}
      {status === "error" ? (
        <span className={styles.shareStatus}>Kunde inte öppna delning. Testa ZIP.</span>
      ) : null}
    </span>
  );
}

function getButtonText(
  status: "idle" | "loading" | "ready" | "sharing" | "done" | "unsupported" | "error",
  label: string,
  start: number,
  end: number,
  total: number,
) {
  switch (status) {
    case "loading":
      return `Förbereder ${start + 1}–${Math.min(start + maxBatchFiles, total)}...`;
    case "ready":
      return total > 1 ? `Öppna delning: ${start + 1}–${end}` : "Öppna delning";
    case "sharing":
      return "Delar...";
    case "done":
      return "Klart – börja om";
    default:
      return label;
  }
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

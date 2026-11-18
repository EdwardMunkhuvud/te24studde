"use client";

import { useState } from "react";

import styles from "./celebration-survey.module.css";

export function CelebrationLink({ path }: { path: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "fallback">("idle");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setStatus("copied");
    } catch {
      setStatus("fallback");
    }
  }

  return (
    <div className={styles.linkControls}>
      <button type="button" className="button button-secondary" onClick={copyLink}>
        {status === "copied" ? "Kopierad" : "Kopiera länk"}
      </button>
      <span className="sr-only" role="status">
        {status === "copied" ? "Länken kopierades." : status === "fallback" ? "Kopiera länken från textfältet." : ""}
      </span>
      {status === "fallback" && (
        <label className="field">
          <span>Gemensam länk</span>
          <input readOnly value={new URL(path, window.location.origin).href} onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
    </div>
  );
}

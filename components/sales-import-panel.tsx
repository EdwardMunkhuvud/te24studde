"use client";

import { useState } from "react";

import { previewSalesImportAction, saveSalesImportAction } from "@/app/(protected)/admin/sales-import-actions";
import { formatCurrency } from "@/lib/utils";
import styles from "@/components/admin-sales.module.css";

type Account = { username: string; name: string };
type Preview = NonNullable<Awaited<ReturnType<typeof previewSalesImportAction>>["preview"]>;

export function SalesImportPanel({ accounts }: { accounts: Account[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState<"preview" | "save" | null>(null);
  const [prepared, setPrepared] = useState<{ text: string; preview: Preview } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const template = JSON.stringify({
    title: "Försäljningsomgång",
    date: "",
    entries: accounts.map(({ username, name }) => ({ username, name, amount: 0 })),
  }, null, 2);

  async function previewFile() {
    if (!file || pending) return;
    setPrepared(null);
    setError("");
    setNotice("");
    if (file.size > 128 * 1024) {
      setError("JSON-filen får vara högst 128 KB.");
      return;
    }

    setPending("preview");
    try {
      const text = await file.text();
      const response = await previewSalesImportAction(text);
      if (response.preview) setPrepared({ text, preview: response.preview });
      else setError(response.error);
    } catch {
      setError("Filen kunde inte förhandsgranskas. Försök igen.");
    } finally {
      setPending(null);
    }
  }

  async function saveFile() {
    if (!prepared || pending) return;
    setPending("save");
    setError("");
    try {
      const response = await saveSalesImportAction(prepared.text, prepared.preview.fingerprint);
      if (response.result) {
        setNotice(`${response.result.count} poster importerades, totalt ${formatCurrency(response.result.total)}.`);
      } else {
        setError(response.error);
      }
    } catch {
      setError("Importen kunde inte bekräftas. Förhandsgranska filen igen för att kontrollera status.");
    } finally {
      setPrepared(null);
      setPending(null);
    }
  }

  const preview = prepared?.preview;

  return (
    <article className="panel stack">
      <div className="section-heading">
        <h2>Importera försäljning från JSON</h2>
      </div>
      <p className="panel-subtle">
        Lägg in en omgång för hela klassen. Ange beloppen som hela kronor. Rader med noll kronor hoppas över.
      </p>
      <div className="inline-actions">
        <a
          className="button button-secondary"
          download="forsaljningsmall.json"
          href={`data:application/json;charset=utf-8,${encodeURIComponent(template)}`}
        >
          Ladda ner JSON-mall
        </a>
      </div>
      <label className="field">
        <span>JSON-fil</span>
        <input
          type="file"
          accept=".json,application/json"
          disabled={pending !== null}
          onChange={(event) => {
            setFile(event.currentTarget.files?.[0] ?? null);
            setPrepared(null);
            setError("");
            setNotice("");
          }}
        />
      </label>
      <div className="inline-actions">
        <button className="button button-secondary" type="button" disabled={!file || pending !== null} onClick={previewFile}>
          {pending === "preview" ? "Läser filen…" : "Förhandsgranska"}
        </button>
      </div>

      {error ? <p className="banner danger" role="alert">{error}</p> : null}
      {notice ? <p className="banner success" role="status">{notice}</p> : null}

      {preview ? (
        <div className="stack">
          <div>
            <h3>{preview.title}{preview.date ? ` · ${preview.date}` : ""}</h3>
            <p className="small-text" role="status">
              {preview.rows.length} poster · {formatCurrency(preview.total)}
              {preview.skipped > 0 ? ` · ${preview.skipped} rader med noll kronor` : ""}
            </p>
          </div>
          <div className={`table-wrap ${styles.previewRows}`} tabIndex={0} aria-label="Förhandsgranskade försäljningsposter">
            <table className="data-table">
              <thead><tr><th scope="col">Konto</th><th scope="col">Belopp</th></tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.username}>
                    <th scope="row">
                      {row.name}
                      <p className="small-text">{row.username}</p>
                      {row.note ? <p className="small-text">{row.note}</p> : null}
                    </th>
                    <td>{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="inline-actions">
            <button className="button button-primary" type="button" disabled={pending !== null} onClick={saveFile}>
              {pending === "save" ? "Importerar…" : `Importera ${preview.rows.length} poster`}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

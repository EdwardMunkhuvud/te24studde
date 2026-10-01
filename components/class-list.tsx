"use client";

import { useId, useState } from "react";
import { Search, Trophy } from "lucide-react";
import type { StudentRow } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/utils";
import { ProgressBar } from "@/components/progress-bar";

function searchable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("sv");
}

export function ClassList({ rows, currentUserId, admin = false }: { rows: StudentRow[]; currentUserId?: string; admin?: boolean }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("total");
  const id = useId();
  const filtered = rows.filter((row) => searchable(`${row.name} ${row.username}`).includes(searchable(query.trim()))).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "sv") : sort === "remaining" ? b.remainingAmount - a.remainingAmount || a.name.localeCompare(b.name, "sv") : b.totalAmount - a.totalAmount || a.name.localeCompare(b.name, "sv"));
  const rank = (row: StudentRow) => rows.filter((candidate) => candidate.totalAmount > row.totalAmount).length + 1;
  const remaining = (row: StudentRow) => row.remainingAmount <= 0 ? "Målet nått ✓" : `${formatCurrency(row.remainingAmount)} kvar`;
  return (
    <div className="stack">
      <div className="list-toolbar">
        <div className="field search-field"><label htmlFor={`${id}-search`}>Hitta i klassen</label><div><Search size={18} aria-hidden="true" /><input id={`${id}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sök namn…" /></div></div>
        <label className="field"><span>Sortera efter</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="total">Mest insamlat</option><option value="name">Namn A–Ö</option><option value="remaining">Mest kvar till målet</option></select></label>
      </div>
      <p className="small-text" role="status">Visar {filtered.length} av {rows.length} i klassen · {rows.filter((row) => row.remainingAmount <= 0).length} har nått sitt mål</p>
      {filtered.length === 0 ? <div className="feed-empty"><p>Ingen matchning för ”{query}”.</p><button className="button button-secondary" onClick={() => setQuery("")}>Visa hela klassen</button></div> : <>
        <div className="table-wrap class-desktop"><table className="data-table"><caption className="sr-only">Klassens insamling och framsteg</caption><thead><tr><th scope="col">Plats</th><th scope="col">Namn</th>{admin ? <th scope="col">Användarnamn</th> : null}<th scope="col">Insamlat</th><th scope="col">Till målet</th><th scope="col">Framsteg</th>{admin ? <th scope="col">Poster</th> : null}</tr></thead><tbody>{filtered.map((row) => <tr className={row.id === currentUserId ? "highlight-row" : undefined} key={row.id}><td>#{rank(row)}</td><th scope="row">{row.name}{row.id === currentUserId ? <span className="row-pill">Du</span> : null}{admin && row.role === "ADMIN" ? <span className="row-pill">Admin</span> : null}</th>{admin ? <td>{row.username}</td> : null}<td>{formatCurrency(row.totalAmount)}</td><td className={row.remainingAmount <= 0 ? "goal-reached" : undefined}>{remaining(row)}</td><td><div className="table-progress"><ProgressBar value={row.progressPercent} /><span>{Math.round(row.progressPercent)}%</span></div></td>{admin ? <td>{row.contributionCount}</td> : null}</tr>)}</tbody></table></div>
        <div className="class-mobile">{filtered.map((row) => <article className={`class-person ${row.id === currentUserId ? "highlight-row" : ""}`} key={row.id}><div className="class-person-heading"><strong>{row.name}{row.id === currentUserId ? <span className="row-pill">Du</span> : null}</strong><span className="rank-badge">{rank(row) === 1 ? <Trophy size={14} aria-hidden="true" /> : null}#{rank(row)}</span></div>{admin ? <p className="small-text">{row.username} · {row.role === "ADMIN" ? "Admin" : "Elev"} · {row.contributionCount} poster</p> : null}<div className="class-person-amount"><strong>{formatCurrency(row.totalAmount)}</strong><span className={row.remainingAmount <= 0 ? "goal-reached" : "small-text"}>{remaining(row)}</span></div><ProgressBar value={row.progressPercent} /></article>)}</div>
      </>}
    </div>
  );
}

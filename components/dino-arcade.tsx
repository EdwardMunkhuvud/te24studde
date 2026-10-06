"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DinoLeaderboard, DinoResult, DinoScore } from "@/lib/dino-types";
import styles from "./dino-arcade.module.css";

const digits = (score: number) => String(score).padStart(5, "0");
const dateLabel = (date: string) => new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" }).format(new Date(date));

async function api<T>(body?: object): Promise<T> {
  const response = await fetch("/api/dino", {
    method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(15000),
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Kunde inte nå topplistan.");
  return data;
}

export function DinoArcade({ userId, name }: { userId: string; name: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const mounted = useRef(false);
  const best = useRef(0);
  const fetching = useRef(false);
  const failed = useRef(new Map<string, DinoResult>());
  const saving = useRef(new Set<string>());
  const [board, setBoard] = useState<DinoLeaderboard | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const send = useCallback((type: string, extra: object = {}) => {
    frame.current?.contentWindow?.postMessage({ channel: "studde-dino", type, ...extra }, window.location.origin);
  }, []);

  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const next = await api<DinoLeaderboard>();
      if (!mounted.current) return;
      best.current = Math.max(best.current, next.personalBest);
      setBoard(next);
      setError("");
      send("best", { best: best.current });
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Kunde inte hämta topplistan.");
    } finally { fetching.current = false; }
  }, [send]);

  const save = useCallback(async (result: DinoResult) => {
    if (saving.current.has(result.runId)) return;
    saving.current.add(result.runId);
    if (mounted.current) setStatus(`Sparar ${digits(result.score)} poäng…`);
    try {
      await api({ action: "finish", ...result });
      failed.current.delete(result.runId);
      best.current = Math.max(best.current, result.score);
      if (mounted.current) {
        setStatus(`${digits(result.score)} poäng sparade på ${name}.`);
        send("best", { best: best.current });
        void refresh();
      }
    } catch (cause) {
      failed.current.set(result.runId, result);
      if (mounted.current) setStatus(`${digits(result.score)} poäng kunde inte sparas. ${cause instanceof Error ? cause.message : "Försök igen."}`);
    } finally {
      saving.current.delete(result.runId);
      if (mounted.current) setRetryCount(failed.current.size);
    }
  }, [name, refresh, send]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== "studde-dino") return;
      const data = event.data;
      if (data.type === "ready") {
        send("init", { best: best.current });
        frame.current?.focus({ preventScroll: true });
      }
      else if (data.type === "start") {
        try {
          const run = await api<{ runId: string }>({ action: "start" });
          if (mounted.current) send("started", run);
        } catch (cause) {
          if (mounted.current) send("start-error", { error: cause instanceof Error ? cause.message : "Kunde inte starta rundan." });
        }
      } else if (data.type === "finish" && typeof data.runId === "string" && Number.isSafeInteger(data.score) && Number.isSafeInteger(data.durationMs)) {
        void save({ runId: data.runId, score: data.score, durationMs: data.durationMs });
      }
    };
    const visibleRefresh = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("message", onMessage);
    window.addEventListener("focus", visibleRefresh);
    const timer = window.setInterval(visibleRefresh, 30000);
    return () => {
      mounted.current = false;
      window.removeEventListener("message", onMessage);
      window.removeEventListener("focus", visibleRefresh);
      window.clearInterval(timer);
    };
  }, [refresh, save, send]);

  const myBest = Math.max(board?.personalBest ?? 0, best.current);
  const podium = board?.topRuns ?? [];

  return (
    <section className={styles.arcade} aria-label="Dino och klassens topplista">
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>TE24 / KLASSENS ARKAD</span><h1>Dino Run<span>_</span></h1><p>Hoppa. Ducka. Slå klassrekordet.</p></div>
        <div className={styles.personal}><span>DITT REKORD</span><strong>{digits(myBest)}</strong><small>{name}</small></div>
      </header>

      <div className={styles.stage}>
        <div className={styles.stageLabel}><span>CHROME DINO</span><span>HI {digits(myBest)}</span></div>
        <iframe ref={frame} src="/dino/index.html" title="Chrome Dino: hoppa med mellanslag eller pil upp, ducka med pil ned" className={styles.frame} />
        <div className={styles.instructions}><span><kbd>SPACE</kbd> / <kbd>↑</kbd> hoppa</span><span><kbd>↓</kbd> ducka</span><span>Mobil: tryck för att hoppa</span></div>
      </div>

      <div className={styles.saveStatus} role="status" aria-live="polite">
        <span>{status || `Dina rundor sparas automatiskt på ${name}.`}</span>
        {retryCount > 0 && <button type="button" onClick={() => { for (const result of failed.current.values()) void save(result); }}>Försök spara igen ({retryCount})</button>}
      </div>

      <div className={styles.leaderboards}>
        <article className={styles.board}>
          <div className={styles.boardHeading}><div><span className={styles.eyebrow}>HALL OF FAME</span><h2>Topp 5 rundor</h2></div><span className={styles.tag}>ALL TIME</span></div>
          <p className={styles.description}>De fem bästa rundorna. En spelare kan ha flera platser.</p>
          {board ? podium.length ? <ol className={styles.topRuns}>{podium.map((run, index) => <RunRow key={run.id} run={run} rank={index + 1} mine={run.userId === userId} />)}</ol> : <p className={styles.empty}>Startfältet är tomt.<br />Sätt klassens första rekord!</p> : <p className={styles.empty}>{error ? "Topplistan är tillfälligt otillgänglig." : "Hämtar rundor…"}</p>}
        </article>

        <article className={styles.board}>
          <div className={styles.boardHeading}><div><span className={styles.eyebrow}>LEADERBOARD</span><h2>Allas personbästa</h2></div><span className={styles.tag}>{board?.players.length ?? "—"} SPELARE</span></div>
          <p className={styles.description}>En plats per person. Ditt bästa försök räknas.</p>
          {board ? <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.srOnly}>Alla konton och deras bästa Dino-poäng</caption><thead><tr><th scope="col">#</th><th scope="col">Spelare</th><th scope="col">Poäng</th></tr></thead><tbody>{board.players.map((player, index) => <tr key={player.userId} className={player.userId === userId ? styles.mine : undefined}><td>{player.best ? String(index + 1).padStart(2, "0") : "—"}</td><th scope="row">{player.best?.name ?? player.name}{player.userId === userId && <small>DU</small>}</th><td>{player.best ? digits(player.best.score) : <span className={styles.unplayed}>Ej spelat</span>}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>{error ? "Försök hämta topplistan igen." : "Hämtar spelare…"}</p>}
        </article>
      </div>
      <footer className={styles.footer}><span>Originalspelet från Chromium · <a href="/dino/LICENSE" target="_blank" rel="noreferrer">BSD-licens</a></span><button type="button" onClick={() => void refresh()}>↻ Uppdatera topplistan</button></footer>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}

function RunRow({ run, rank, mine }: { run: DinoScore; rank: number; mine: boolean }) {
  return <li className={`${styles.runRow} ${rank === 1 ? styles.champion : ""} ${mine ? styles.mine : ""}`}><span className={styles.rank}>{String(rank).padStart(2, "0")}</span><div className={styles.runPlayer}><strong>{run.name}{mine && <small>DU</small>}</strong><time dateTime={run.completedAt}>{dateLabel(run.completedAt)}</time></div><strong className={styles.runScore}>{digits(run.score)}</strong></li>;
}

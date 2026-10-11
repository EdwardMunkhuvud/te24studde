"use client";
import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import styles from "./study-hub.module.css";

export function useStudyTimer() {
  const [minutes, setMinutes] = useState(25); const [remaining, setRemaining] = useState(25 * 60);
  const [deadline, setDeadline] = useState<number | null>(null); const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); setRemaining(seconds);
      if (!seconds) { setDeadline(null); setFinished(true); }
    };
    tick(); const interval = setInterval(tick, 500); return () => clearInterval(interval);
  }, [deadline]);
  return { minutes, setMinutes, remaining, setRemaining, deadline, setDeadline, finished, setFinished };
}
export type StudyTimerState = ReturnType<typeof useStudyTimer>;
export function StudyTimer({ timer }: { timer: StudyTimerState }) {
  const { minutes, setMinutes, remaining, setRemaining, deadline, setDeadline, finished, setFinished } = timer;
  return <aside className={styles.timer} aria-label="Fokustimer">
    <div className={styles.row}><Timer size={18} /><strong>Ett steg i taget</strong></div>
    <p className={styles.subtle}>Välj ett material och ge det en stund av fullt fokus.</p>
    <div className={styles.row}>
      <span className={styles.timerDigits} aria-label={`${Math.floor(remaining / 60)} minuter och ${remaining % 60} sekunder`}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>
      <select aria-label="Längd på fokuspass" value={minutes} disabled={deadline !== null} onChange={(e) => { const value = Number(e.target.value); setMinutes(value); setRemaining(value * 60); setFinished(false); }}>
        <option value={15}>15 min fokus</option><option value={25}>25 min fokus</option><option value={45}>45 min fokus</option><option value={5}>5 min paus</option>
      </select>
    </div>
    <div className={styles.row}>
      <button className="button button-primary" onClick={() => {
        setFinished(false);
        if (deadline) { setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))); setDeadline(null); }
        else { const seconds = remaining || minutes * 60; setRemaining(seconds); setDeadline(Date.now() + seconds * 1000); }
      }}>{deadline ? <Pause size={16} /> : <Play size={16} />}{deadline ? "Pausa" : remaining === minutes * 60 || !remaining ? "Starta fokus" : "Fortsätt"}</button>
      <button className="button button-secondary" aria-label="Återställ timer" onClick={() => { setDeadline(null); setRemaining(minutes * 60); setFinished(false); }}><RotateCcw size={16} /></button>
    </div>
    {finished ? <p role="status" className={styles.success}>Passet är klart. Dags att sträcka på dig!</p> : null}
  </aside>;
}

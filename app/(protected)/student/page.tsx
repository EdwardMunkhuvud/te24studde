import { redirect } from "next/navigation";

import { EarningsChart } from "@/components/earnings-chart";
import { ProgressBar } from "@/components/progress-bar";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { getStudentDashboard } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/utils";

export default async function StudentPage() {
  const session = await requireSession();

  if (session.role !== ROLES.STUDENT) {
    redirect("/admin");
  }

  const data = await getStudentDashboard(session.userId);
  const student = data.currentStudent;
  const historyData = student.history.map((point) => ({
    label: point.label,
    total: point.total,
    amount: point.amount,
  }));
  const remainingText =
    student.remainingAmount > 0
      ? `${formatCurrency(student.remainingAmount)} kvar till målet`
      : `${formatCurrency(Math.abs(student.remainingAmount))} över målet`;

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="eyebrow">Din klasskassa</span>
          <h1>{student.name}</h1>
          <p>
            Du har samlat in <strong>{formatCurrency(student.totalAmount)}</strong> och ligger på plats{" "}
            <strong>#{data.rank}</strong> i klassen.
          </p>
        </div>
        <div className="hero-note">
          <span>Målet för dig</span>
          <strong>{formatCurrency(student.targetAmount)}</strong>
          <p>{remainingText}</p>
        </div>
      </section>

      <section className="metric-grid">
        <article className="panel">
          <span className="panel-label">Din totalsumma</span>
          <strong className="panel-value">{formatCurrency(student.totalAmount)}</strong>
          <ProgressBar value={student.progressPercent} />
        </article>
        <article className="panel">
          <span className="panel-label">Kvar till målet</span>
          <strong className="panel-value">{formatCurrency(student.remainingAmount)}</strong>
          <p className="panel-subtle">Negativt värde betyder att du redan gått över målet.</p>
        </article>
        <article className="panel">
          <span className="panel-label">Klassens totalsumma</span>
          <strong className="panel-value">{formatCurrency(data.classTotal)}</strong>
          <p className="panel-subtle">Snitt per elev: {formatCurrency(data.averageAmount)}</p>
        </article>
        <article className="panel">
          <span className="panel-label">Klassens mål</span>
          <strong className="panel-value">{formatCurrency(data.classTarget)}</strong>
          <p className="panel-subtle">{data.classRows.length} elever registrerade</p>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-large">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Historik</span>
              <h2>Din utveckling över tid</h2>
            </div>
          </div>
          <EarningsChart data={historyData} />
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Poster</span>
              <h2>Det som registrerats på dig</h2>
            </div>
          </div>
          <div className="history-list">
            {student.history.map((entry) => (
              <div className="history-item" key={entry.id}>
                <div>
                  <strong>{entry.label}</strong>
                  <p>
                    {entry.kindLabel}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </p>
                </div>
                <span>{formatCurrency(entry.amount)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Klassen</span>
            <h2>Så ligger alla till just nu</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Placering</th>
                <th>Namn</th>
                <th>Totalt</th>
                <th>Kvar</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.classRows.map((row, index) => (
                <tr className={row.id === student.id ? "highlight-row" : undefined} key={row.id}>
                  <td>#{index + 1}</td>
                  <td>
                    {row.name}
                    {row.id === student.id ? <span className="row-pill">Du</span> : null}
                  </td>
                  <td>{formatCurrency(row.totalAmount)}</td>
                  <td>{formatCurrency(row.remainingAmount)}</td>
                  <td>{Math.round(row.progressPercent)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

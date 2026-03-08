import { redirect } from "next/navigation";

import {
  submitOptionVoteAction,
  submitSuggestionVoteAction,
} from "@/app/actions";
import { EarningsChart } from "@/components/earnings-chart";
import { ProgressBar } from "@/components/progress-bar";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth";
import { POLL_TYPES, ROLES } from "@/lib/constants";
import { getStudentDashboard } from "@/lib/dashboard";
import { formatCurrency, formatDateLabel } from "@/lib/utils";

type StudentPageProps = {
  searchParams?: {
    error?: string;
    status?: string;
  };
};

function getStudentBanner(searchParams: StudentPageProps["searchParams"]) {
  if (searchParams?.status === "vote-saved") {
    return {
      type: "success",
      message: "Ditt svar sparades.",
    };
  }

  if (searchParams?.error === "invalid-vote") {
    return {
      type: "error",
      message: "Kunde inte spara ditt svar. Testa igen.",
    };
  }

  return null;
}

export default async function StudentPage({ searchParams }: StudentPageProps) {
  const session = await requireSession();

  if (session.role !== ROLES.STUDENT) {
    redirect("/admin");
  }

  const data = await getStudentDashboard(session.userId);
  const student = data.currentStudent;
  const banner = getStudentBanner(searchParams);
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

      {banner ? <div className={banner.type === "error" ? "banner danger" : "banner success"}>{banner.message}</div> : null}

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
          <span className="panel-label">Öppna omröstningar</span>
          <strong className="panel-value">{data.polls.filter((poll) => poll.isOpen).length}</strong>
          <p className="panel-subtle">{data.announcements.length} announcements publicerade</p>
        </article>
      </section>

      <section className="feed-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Feed</span>
              <h2>Senaste announcements</h2>
            </div>
          </div>
          <div className="feed-list">
            {data.announcements.length === 0 ? (
              <div className="feed-empty">Inga announcements just nu.</div>
            ) : (
              data.announcements.map((announcement) => (
                <article className="announcement-card" key={announcement.id}>
                  <div className="announcement-meta">
                    <span>{announcement.authorName}</span>
                    <span>{formatDateLabel(announcement.publishedAt)}</span>
                  </div>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.body}</p>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Omröstningar</span>
              <h2>Rösta eller lämna förslag</h2>
            </div>
          </div>
          <div className="feed-list">
            {data.polls.length === 0 ? (
              <div className="feed-empty">Inga omröstningar ännu.</div>
            ) : (
              data.polls.map((poll) => (
                <article className="poll-card" key={poll.id}>
                  <div className="poll-topline">
                    <span className={`status-pill ${poll.isOpen ? "open" : "closed"}`}>
                      {poll.isOpen ? "Öppen" : "Stängd"}
                    </span>
                    <span>{formatDateLabel(poll.createdAt)}</span>
                  </div>
                  <h3>{poll.title}</h3>
                  <p>{poll.description}</p>

                  {poll.type === POLL_TYPES.OPTION ? (
                    <>
                      <div className="poll-options">
                        {poll.options.map((option) => (
                          <div className="poll-option-row" key={option.id}>
                            <div className="poll-option-label">
                              <span>
                                {option.label}
                                {option.selectedByCurrentUser ? <strong className="inline-tag">Ditt val</strong> : null}
                              </span>
                              <strong>{option.voteCount} röster</strong>
                            </div>
                            <div className="option-bar">
                              <div style={{ width: `${option.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {poll.isOpen ? (
                        <form action={submitOptionVoteAction} className="poll-submit">
                          <input name="pollId" type="hidden" value={poll.id} />
                          <div className="choice-list">
                            {poll.options.map((option) => (
                              <label className="choice-card" key={option.id}>
                                <input
                                  defaultChecked={poll.currentUserResponse?.optionId === option.id}
                                  name="optionId"
                                  type="radio"
                                  value={option.id}
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                          <SubmitButton className="button button-primary" pendingLabel="Sparar svar...">
                            Spara röst
                          </SubmitButton>
                        </form>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {poll.suggestions.length > 0 ? (
                        <div className="response-grid">
                          {poll.suggestions.map((suggestion) => (
                            <div className="response-item" key={suggestion.id}>
                              <p>{suggestion.text}</p>
                              <span>{suggestion.isOwn ? "Ditt förslag" : "Anonymt förslag"}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="feed-empty">Inga förslag skickade ännu.</div>
                      )}
                      {poll.isOpen ? (
                        <form action={submitSuggestionVoteAction} className="poll-submit">
                          <input name="pollId" type="hidden" value={poll.id} />
                          <label className="field">
                            <span>Ditt förslag</span>
                            <textarea
                              defaultValue={poll.currentUserResponse?.suggestionText ?? ""}
                              name="suggestionText"
                              placeholder="Skriv ditt förslag här"
                              rows={4}
                            />
                          </label>
                          <SubmitButton className="button button-primary" pendingLabel="Skickar förslag...">
                            Skicka förslag
                          </SubmitButton>
                        </form>
                      ) : null}
                    </>
                  )}
                </article>
              ))
            )}
          </div>
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

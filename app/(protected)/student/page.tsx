import Link from "next/link";
import { StudentGallery } from "@/components/student-gallery";
import { AttachedPhotos } from "@/components/attached-photos";
import { getPhotoPage } from "@/lib/student-photos";
import { isR2Configured } from "@/lib/r2";
import { ClassList } from "@/components/class-list";
import { redirect } from "next/navigation";

import { submitOptionVoteAction, submitSuggestionVoteAction } from "@/app/actions";
import { PageTabs, type PageTabItem } from "@/components/page-tabs";
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
    tab?: string;
  };
};

const STUDENT_TAB_KEYS = ["overview", "announcements", "polls", "history", "class", "photos"] as const;

type StudentTab = (typeof STUDENT_TAB_KEYS)[number];

function resolveStudentTab(tab?: string): StudentTab {
  return STUDENT_TAB_KEYS.find((candidate) => candidate === tab) ?? "overview";
}

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
  const activeTab = resolveStudentTab(searchParams?.tab);
  const historyData = student.history.map((point) => ({
    label: point.label,
    total: point.total,
    amount: point.amount,
  }));
  const photoPage = activeTab === "photos" ? await getPhotoPage() : null;
  const photoUploadsEnabled = isR2Configured();
  const latestAnnouncement = data.announcements[0] ?? null;
  const latestHistoryEntry = student.history[student.history.length - 1] ?? null;
  const orderedPolls = [...data.polls].sort((a, b) => Number(b.isOpen) - Number(a.isOpen) || Number(Boolean(a.currentUserResponse)) - Number(Boolean(b.currentUserResponse)));
  const unansweredCount = data.polls.filter((poll) => poll.isOpen && !poll.currentUserResponse).length;
  const openPollCount = data.polls.filter((poll) => poll.isOpen).length;
  const remainingText =
    student.remainingAmount > 0
      ? `${formatCurrency(student.remainingAmount)} kvar till målet`
      : student.remainingAmount === 0 ? "Målet är nått. Snyggt jobbat!" : `${formatCurrency(Math.abs(student.remainingAmount))} över målet — snyggt jobbat!`;
  const tabs: PageTabItem[] = [
    { key: "overview", label: "Översikt" },
    { key: "photos", label: "Studentbilder" },
    { key: "announcements", label: "Meddelanden", badge: data.announcements.length || null },
    { key: "polls", label: "Omröstningar", badge: unansweredCount || null },
    { key: "history", label: "Historik" },
    { key: "class", label: "Klassen" },
  ];

  return (
    <div className="page-stack">
      <section className={`page-hero ${activeTab !== "overview" ? "page-hero-compact" : ""}`}>
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

      {banner ? <div role={banner.type === "error" ? "alert" : "status"} className={banner.type === "error" ? "banner danger" : "banner success"}>{banner.message}</div> : null}

      <PageTabs activeTab={activeTab} basePath="/student" tabs={tabs} />

      {activeTab === "photos" && photoPage ? <StudentGallery initialPage={photoPage} userId={session.userId} admin={false} enabled={photoUploadsEnabled} /> : null}

      {activeTab === "overview" ? (
        <>
          <section className="metric-grid">
            <article className="panel">
              <span className="panel-label">Din totalsumma</span>
              <strong className="panel-value">{formatCurrency(student.totalAmount)}</strong>
              <ProgressBar value={student.progressPercent} />
            </article>
            <article className="panel">
              <span className="panel-label">{student.remainingAmount < 0 ? "Över målet" : "Kvar till målet"}</span>
              <strong className="panel-value">{formatCurrency(Math.abs(student.remainingAmount))}</strong>
              <p className="panel-subtle">{student.remainingAmount <= 0 ? "Du är i mål! Tack för ditt bidrag till studenten." : "Lite närmare studenten för varje bidrag."}</p>
            </article>
            <article className="panel">
              <span className="panel-label">Klassens totalsumma</span>
              <strong className="panel-value">{formatCurrency(data.classTotal)}</strong>
              <p className="panel-subtle">Snitt per elev: {formatCurrency(data.averageAmount)}</p>
            </article>
            <article className="panel">
              <span className="panel-label">Öppna omröstningar</span>
              <strong className="panel-value">{openPollCount}</strong>
              <p className="panel-subtle">{data.announcements.length} {data.announcements.length === 1 ? "meddelande publicerat" : "meddelanden publicerade"}</p>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel panel-large">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Utveckling</span>
                  <h2>Din kurva över tid</h2>
                </div>
              </div>
              <EarningsChart data={historyData} />
            </article>

            <article className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Snabbkoll</span>
                  <h2>Det viktigaste just nu</h2>
                </div>
              </div>
              <div className="stack">
                <Link className="info-callout quick-link-card" href="/student?tab=polls">
                  <strong>{unansweredCount > 0 ? `${unansweredCount} ${unansweredCount === 1 ? "omröstning väntar" : "omröstningar väntar"} på ditt svar` : "Du har svarat på allt som är öppet ✓"}</strong>
                  <p>{unansweredCount > 0 ? "Vad tycker du? Rösta eller lämna ett förslag." : "Kika på resultaten eller ändra ditt svar."}</p>
                </Link>
                {latestAnnouncement ? (
                  <Link
                    className="announcement-card quick-link-card"
                    href={`/student?tab=announcements#announcement-${latestAnnouncement.id}`}
                  >
                    <div className="announcement-meta">
                      <span>{latestAnnouncement.authorName}</span>
                      <span>{formatDateLabel(latestAnnouncement.publishedAt)}</span>
                    </div>
                    <h3>{latestAnnouncement.title}</h3>
                    <p>{latestAnnouncement.body}</p>
                  </Link>
                ) : (
                  <div className="feed-empty">Inga meddelanden just nu.</div>
                )}
                {latestHistoryEntry ? (
                  <Link className="history-item quick-link-card" href="/student?tab=history">
                    <div>
                      <strong>Senast registrerat</strong>
                      <p>
                        {latestHistoryEntry.label}
                        {latestHistoryEntry.note ? ` · ${latestHistoryEntry.note}` : ""}
                      </p>
                    </div>
                    <span>{formatCurrency(latestHistoryEntry.amount)}</span>
                  </Link>
                ) : (
                  <div className="feed-empty">Inga poster registrerade ännu.</div>
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {activeTab === "announcements" ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Feed</span>
              <h2>Senaste meddelanden</h2>
            </div>
          </div>
          <div className="feed-list">
            {data.announcements.length === 0 ? (
              <div className="feed-empty">Inga meddelanden just nu.</div>
            ) : (
              data.announcements.map((announcement) => (
                <article className="announcement-card jump-target" id={`announcement-${announcement.id}`} key={announcement.id}>
                  <div className="announcement-meta">
                    <span>{announcement.authorName}</span>
                    <span>{formatDateLabel(announcement.publishedAt)}</span>
                  </div>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.body}</p>
                  <AttachedPhotos photos={announcement.photos} />
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "polls" ? (
        <section className="panel">
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
              orderedPolls.map((poll) => (
                <article className="poll-card" key={poll.id}>
                  <div className="poll-topline">
                    <span className={`status-pill ${poll.isOpen ? "open" : "closed"}`}>
                      {poll.isOpen ? "Öppen" : "Stängd"}
                    </span>
                    <span>{formatDateLabel(poll.createdAt)}</span>
                  </div>
                  <h3>{poll.title}</h3>
                  <p>{poll.description}</p>
                  <AttachedPhotos photos={poll.photos} />

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
                              <strong>{option.voteCount} {option.voteCount === 1 ? "röst" : "röster"}</strong>
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
                          <input name="tab" type="hidden" value="polls" />
                          <fieldset className="vote-choices"><legend>Välj ett alternativ</legend><div className="choice-list">
                            {poll.options.map((option) => (
                              <label className="choice-card" key={option.id}>
                                <input
                                  defaultChecked={poll.currentUserResponse?.optionId === option.id}
                                  required
                                  name="optionId"
                                  type="radio"
                                  value={option.id}
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div></fieldset>
                          <p className="small-text">Du kan ändra din röst så länge omröstningen är öppen.</p>
                          <SubmitButton className="button button-primary" pendingLabel="Sparar svar...">
                            {poll.currentUserResponse ? "Uppdatera min röst" : "Spara min röst"}
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
                          <input name="tab" type="hidden" value="polls" />
                          <p className="small-text">Andra elever ser förslaget utan ditt namn. Admin kan se vem som skickat det.</p>
                          <label className="field">
                            <span>Ditt förslag (max 250 tecken)</span>
                            <textarea
                              defaultValue={poll.currentUserResponse?.suggestionText ?? ""}
                              required minLength={2} maxLength={250}
                              name="suggestionText"
                              placeholder="Skriv ditt förslag här"
                              rows={4}
                            />
                          </label>
                          <SubmitButton className="button button-primary" pendingLabel="Skickar förslag...">
                            {poll.currentUserResponse ? "Uppdatera mitt förslag" : "Skicka förslag"}
                          </SubmitButton>
                        </form>
                      ) : null}
                    </>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "history" ? (
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
      ) : null}

      {activeTab === "class" ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Klassen</span>
              <h2>Så ligger alla till just nu</h2>
            </div>
          </div>
          <ClassList rows={data.classRows} currentUserId={student.id} />

        </section>
      ) : null}
    </div>
  );
}

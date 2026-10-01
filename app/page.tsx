import Link from "next/link";
import "./normal.css";
import { LoginFields } from "@/components/login-fields";
import { ProgressBar } from "@/components/progress-bar";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getSession } from "@/lib/auth";
import { POLL_TYPES, ROLES } from "@/lib/constants";
import { getPublicStats } from "@/lib/dashboard";
import { formatCurrency, formatDateLabel } from "@/lib/utils";

type HomePageProps = {
  searchParams?: {
    error?: string;
    status?: string;
  };
};

function getBannerCopy(searchParams: HomePageProps["searchParams"]) {
  if (searchParams?.error === "invalid-login") {
    return {
      type: "error",
      message: "Fel användarnamn eller lösenord.",
    };
  }

  if (searchParams?.error === "missing-login") {
    return {
      type: "error",
      message: "Fyll i både användarnamn och lösenord.",
    };
  }

  if (searchParams?.status === "logged-out") {
    return {
      type: "success",
      message: "Du är nu utloggad.",
    };
  }

  return null;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getSession();

  if (session) {
    redirect(session.role === ROLES.ADMIN ? "/admin" : "/student");
  }

  const stats = await getPublicStats();
  const banner = getBannerCopy(searchParams);
  const activePolls = stats.polls.filter((poll) => poll.isOpen);

  return (
    <main className="landing-page normal-site">
      <div className="landing-background" />
      <a className="skip-link" href="#login">Till inloggningen</a>
      <header className="landing-nav landing-shell"><Link className="brand-mark" href="/">Studde<span className="brand-dot">.</span></Link><span className="small-text">TE24 · Mot studenten</span><nav className="landing-links" aria-label="Startnavigation"><a className="text-link" href="#information">Senaste nytt ↓</a><a className="landing-login-link" href="#login">Logga in →</a></nav></header>
      <section className="landing-shell landing-intro">
        <div className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">Studde</span>
            <h1>En klass. Ett mål.
              <span className="hero-accent">En riktigt bra student.</span></h1>
            <p className="hero-text">
              Håll koll på klasskassan, rösta på nästa idé och se vad som händer i TE24.
              Allt inför studenten, samlat på ett ställe.
            </p>
            <div className="stat-grid">
              <article className="stat-card">
                <span>Insamlat hittills</span>
                <strong>{formatCurrency(stats.classTotal)}</strong>
              </article>
              <article className="stat-card">
                <span>Klassens mål</span>
                <strong>{formatCurrency(stats.classTarget)}</strong>
              </article>
              <article className="stat-card">
                <span>Aktiva omröstningar</span>
                <strong>{activePolls.length}</strong>
              </article>
              <article className="stat-card">
                <span>Vi gör det tillsammans</span>
                <strong>{stats.studentCount} elever</strong>
              </article>
            </div>
            <div className="goal-summary"><div><span>Klassens väg till målet</span><strong>{stats.classTarget > 0 ? Math.round(stats.classTotal / stats.classTarget * 100) : 0}%</strong></div><ProgressBar value={stats.classTarget > 0 ? stats.classTotal / stats.classTarget * 100 : 0} /><p className="small-text">{stats.classTotal >= stats.classTarget ? "Målet är nått — snyggt jobbat, klassen!" : `${formatCurrency(stats.classTarget - stats.classTotal)} kvar. Varje bidrag räknas.`}</p></div>
          </div>
          <div className="login-card" id="login">
            <div className="login-header">
              <p className="eyebrow">Inloggning</p>
              <h2>Välkommen tillbaka!</h2>
              <p>Logga in för att se din kassa och göra din röst hörd.</p>
            </div>
            {banner ? (
              <div role={banner.type === "error" ? "alert" : "status"} className={banner.type === "error" ? "banner danger" : "banner success"}>{banner.message}</div>
            ) : null}
            <form action={loginAction} className="stack">
              <LoginFields />
              <SubmitButton className="button button-primary" pendingLabel="Loggar in...">
                Logga in
              </SubmitButton>
            </form>
            <div className="info-callout">
              <strong>Hur loggar jag in?</strong>
              <p>Användarnamn: förnamn.efternamn, t.ex. karl.andersson. Lösenordet är vanligtvis ditt förnamn i små bokstäver. Fastnat? Fråga Edvin.</p>
            </div>
            <Link className="text-link" href="https://www.google.com/search?q=idéer+till+studenten" target="_blank" rel="noopener noreferrer">
              Inspiration till studenten ↗
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-shell landing-feed" id="information">
        <div className="feed-grid">
          <article className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feed</span>
                <h2>Information</h2>
              </div>
            </div>
            <div className="feed-list">
              {stats.announcements.length === 0 ? (
                <div className="feed-empty">Här dyker klassens nästa meddelande upp.</div>
              ) : (
                stats.announcements.map((announcement) => (
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
                <h2>Öppet för klassen</h2>
              </div>
            </div>
            <div className="feed-list">
              {activePolls.length === 0 ? (
                <div className="feed-empty">Inga öppna omröstningar just nu. Kika in snart igen!</div>
              ) : (
                activePolls.map((poll) => (
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
                      <div className="poll-options">
                        {poll.options.map((option) => (
                          <div className="poll-option-row" key={option.id}>
                            <div className="poll-option-label">
                              <span>{option.label}</span>
                              <strong>{option.voteCount} {option.voteCount === 1 ? "röst" : "röster"}</strong>
                            </div>
                            <div className="option-bar">
                              <div style={{ width: `${option.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="muted-block">
                        {poll.totalResponses} anonymiserade förslag inskickade hittills.
                      </div>
                    )}
                    <a className="text-link" href="#login">Logga in och gör din röst hörd →</a>
                  </article>
                ))
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

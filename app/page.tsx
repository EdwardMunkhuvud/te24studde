import Link from "next/link";
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
    <main className="landing-page">
      <div className="landing-background" />
      <section className="landing-shell">
        <div className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">Studde</span>
            <h1>Studentkassan, omröstningar och information.</h1>
            <p className="hero-text">
              Varje elev ser sin utveckling, klassens total, aktuell information och omröstningar. Edvin
              sköter sida, så om frågetecken uppstår kontakta honom.
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
                <span>Leder just nu</span>
                <strong>{stats.leadingStudent?.name ?? "Ingen än"}</strong>
              </article>
            </div>
          </div>
          <div className="login-card">
            <div className="login-header">
              <p className="eyebrow">Inloggning</p>
              <h2>Logga in på klassen</h2>
              <p>Använd ditt användarnamn och ditt enkla lösenord för att komma in. Användarnamnet är förnamn och efternamn i små bokstäver med punkt emellan, ex &quot;karl.andersson&quot; och lösenord endast namn i små bokstäver, ex &quot;karl&quot;</p>
            </div>
            {banner ? (
              <div className={banner.type === "error" ? "banner danger" : "banner success"}>{banner.message}</div>
            ) : null}
            <form action={loginAction} className="stack">
              <label className="field">
                <span>Användarnamn</span>
                <input autoComplete="username" name="username" placeholder="t.ex. karl.andersson" type="text" />
              </label>
              <label className="field">
                <span>Lösenord</span>
                <input autoComplete="current-password" name="password" placeholder="t.ex. karl" type="password" />
              </label>
              <SubmitButton className="button button-primary" pendingLabel="Loggar in...">
                Logga in
              </SubmitButton>
            </form>
            <div className="info-callout">
              <strong>Nuvarande admin</strong>
              <p>Edvin hanterar hela sidan och är ansvarig för allt.</p>
            </div>
            <Link className="text-link" href="https://www.google.com/search?q=id%C3%A9er+f%C3%B6r+stundenten&rlz=1C1BYYL_svSE973SE973&oq=id%C3%A9er+f%C3%B6r+stundenten&gs_lcrp=EgZjaHJvbWUyBggAEEUYOTIJCAEQIRgKGKABMgkIAhAhGAoYoAEyBwgDECEYnwUyBwgEECEYnwUyBwgFECEYnwUyBwgGECEYnwUyBwgHECEYnwUyBwgIECEYnwUyBwgJECEYnwXSAQg1MzkzajBqN6gCALACAA&sourceid=chrome&ie=UTF-8">
              Ideér till studenten
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-shell landing-feed">
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
                <div className="feed-empty">Inga announcements än.</div>
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
              {stats.polls.length === 0 ? (
                <div className="feed-empty">Inga omröstningar än.</div>
              ) : (
                stats.polls.map((poll) => (
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
                              <strong>{option.voteCount} röster</strong>
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
                    <p className="small-text">Logga in för att rösta eller skicka in ett förslag.</p>
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

import Link from "next/link";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { getPublicStats } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/utils";

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

  return (
    <main className="landing-page">
      <div className="landing-background" />
      <section className="landing-shell">
        <div className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">Studde</span>
            <h1>Håll klasskassan samlad, tydlig och enkel att följa.</h1>
            <p className="hero-text">
              Varje elev kan logga in och se sin egen utveckling, klassens totalsumma och hur långt det är kvar till
              målet. Adminläget används för att lägga in försäljning, swish och nya elever.
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
                <span>Registrerade elever</span>
                <strong>{stats.studentCount}</strong>
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
              <h2>Se din egen klasskassa</h2>
              <p>Använd ditt användarnamn och lösenord för att komma in.</p>
            </div>
            {banner ? (
              <div className={banner.type === "error" ? "banner danger" : "banner success"}>{banner.message}</div>
            ) : null}
            <form action={loginAction} className="stack">
              <label className="field">
                <span>Användarnamn</span>
                <input autoComplete="username" name="username" placeholder="t.ex. edvin.moberg" type="text" />
              </label>
              <label className="field">
                <span>Lösenord</span>
                <input autoComplete="current-password" name="password" placeholder="Ditt lösenord" type="password" />
              </label>
              <SubmitButton className="button button-primary" pendingLabel="Loggar in...">
                Logga in
              </SubmitButton>
            </form>
            <p className="small-text">
              Edvin använder adminkontot. Alla andra elever ser sin egen sida efter inloggning.
            </p>
            <Link className="text-link" href="https://www.studenten.se/">
              Planera studenten vidare
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

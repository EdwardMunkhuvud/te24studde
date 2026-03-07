import {
  createContributionAction,
  createStudentAction,
  resetPasswordAction,
} from "@/app/actions";
import { EarningsChart } from "@/components/earnings-chart";
import { ProgressBar } from "@/components/progress-bar";
import { SubmitButton } from "@/components/submit-button";
import { requireRole } from "@/lib/auth";
import { CONTRIBUTION_TYPES, ROLES } from "@/lib/constants";
import { getAdminDashboard } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/utils";

type AdminPageProps = {
  searchParams?: {
    error?: string;
    status?: string;
  };
};

function bannerFromParams(searchParams: AdminPageProps["searchParams"]) {
  switch (searchParams?.status) {
    case "transaction-saved":
      return { type: "success", text: "Transaktionen sparades." };
    case "student-saved":
      return { type: "success", text: "Ny elev skapades." };
    case "password-reset":
      return { type: "success", text: "Lösenordet återställdes." };
    case undefined:
      break;
    default:
      return null;
  }

  switch (searchParams?.error) {
    case "invalid-transaction":
      return { type: "error", text: "Kunde inte spara transaktionen. Kontrollera fälten." };
    case "invalid-student":
      return { type: "error", text: "Kunde inte skapa eleven. Kontrollera namn, mål och lösenord." };
    case "invalid-password":
      return { type: "error", text: "Det nya lösenordet måste vara minst 6 tecken." };
    case "unknown-student":
      return { type: "error", text: "Den valda eleven hittades inte." };
    default:
      return null;
  }
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const session = await requireRole(ROLES.ADMIN);
  const data = await getAdminDashboard(session.userId);
  const banner = bannerFromParams(searchParams);
  const adminChartData =
    data.adminSummary?.history.map((point) => ({
      label: point.label,
      total: point.total,
      amount: point.amount,
    })) ?? [];

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="eyebrow">Adminpanel</span>
          <h1>Klasskassan för studenten</h1>
          <p>Här kan du registrera försäljning, swish, nya elever och snabbt se hur hela klassen ligger till.</p>
        </div>
        <div className="hero-note">
          <span>Din roll</span>
          <strong>Edvin Moberg · Admin</strong>
          <p>Du kan lägga in och ändra data för hela klassen.</p>
        </div>
      </section>

      {banner ? <div className={banner.type === "error" ? "banner danger" : "banner success"}>{banner.text}</div> : null}

      <section className="metric-grid">
        <article className="panel">
          <span className="panel-label">Insamlat totalt</span>
          <strong className="panel-value">{formatCurrency(data.classTotal)}</strong>
        </article>
        <article className="panel">
          <span className="panel-label">Klassens mål</span>
          <strong className="panel-value">{formatCurrency(data.classTarget)}</strong>
        </article>
        <article className="panel">
          <span className="panel-label">Snitt per elev</span>
          <strong className="panel-value">{formatCurrency(data.averageAmount)}</strong>
        </article>
        <article className="panel">
          <span className="panel-label">Registrerade poster</span>
          <strong className="panel-value">{data.contributionCount}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-large">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Registrera pengar</span>
              <h2>Lägg till försäljning eller swish</h2>
            </div>
          </div>
          <form action={createContributionAction} className="form-grid">
            <label className="field">
              <span>Elev</span>
              <select name="userId">
                {data.userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                    {user.role === ROLES.ADMIN ? " (admin)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Rubrik</span>
              <input name="title" placeholder="t.ex. Kakförsäljning vecka 11" type="text" />
            </label>
            <label className="field">
              <span>Belopp i kronor</span>
              <input name="amount" placeholder="350" type="number" />
            </label>
            <label className="field">
              <span>Typ</span>
              <select name="kind">
                <option value={CONTRIBUTION_TYPES.SALE}>Försäljning</option>
                <option value={CONTRIBUTION_TYPES.SWISH}>Swish</option>
                <option value={CONTRIBUTION_TYPES.MANUAL}>Manuell justering</option>
              </select>
            </label>
            <label className="field">
              <span>Datum</span>
              <input name="occurredAt" type="date" />
            </label>
            <label className="field field-wide">
              <span>Anteckning</span>
              <textarea name="note" placeholder="Valfritt: exempelvis vad eleven sålde eller varför posten lades in." rows={4} />
            </label>
            <div className="form-footer">
              <p className="small-text">Tips: använd minusbelopp om du behöver korrigera något.</p>
              <SubmitButton className="button button-primary" pendingLabel="Sparar transaktion...">
                Spara transaktion
              </SubmitButton>
            </div>
          </form>
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Din status</span>
              <h2>Så ligger ditt konto till</h2>
            </div>
          </div>
          {data.adminSummary ? (
            <>
              <strong className="panel-value">{formatCurrency(data.adminSummary.totalAmount)}</strong>
              <p className="panel-subtle">
                {formatCurrency(data.adminSummary.remainingAmount)} kvar till ditt personliga mål.
              </p>
              <ProgressBar value={data.adminSummary.progressPercent} />
              <EarningsChart data={adminChartData} />
            </>
          ) : (
            <p className="panel-subtle">Ingen historik registrerad för adminkontot ännu.</p>
          )}
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Nya elever</span>
              <h2>Lägg till elevkonto</h2>
            </div>
          </div>
          <form action={createStudentAction} className="stack">
            <label className="field">
              <span>Fullständigt namn</span>
              <input name="name" placeholder="Förnamn Efternamn" type="text" />
            </label>
            <label className="field">
              <span>Startlösenord</span>
              <input name="password" placeholder="Minst 6 tecken" type="text" />
            </label>
            <label className="field">
              <span>Mål i kronor</span>
              <input defaultValue="1050" name="targetAmount" type="number" />
            </label>
            <SubmitButton className="button button-primary" pendingLabel="Skapar konto...">
              Skapa elev
            </SubmitButton>
          </form>
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Lösenord</span>
              <h2>Återställ elevens lösenord</h2>
            </div>
          </div>
          <form action={resetPasswordAction} className="stack">
            <label className="field">
              <span>Välj elev</span>
              <select name="userId">
                {data.userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Nytt lösenord</span>
              <input name="password" placeholder="Minst 6 tecken" type="text" />
            </label>
            <SubmitButton className="button button-secondary" pendingLabel="Återställer...">
              Återställ lösenord
            </SubmitButton>
          </form>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Överblick</span>
            <h2>Alla elever och deras totalsummor</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Namn</th>
                <th>Användarnamn</th>
                <th>Roll</th>
                <th>Totalt</th>
                <th>Kvar</th>
                <th>Poster</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.username}</td>
                  <td>{row.role === ROLES.ADMIN ? <span className="row-pill">Admin</span> : "Elev"}</td>
                  <td>{formatCurrency(row.totalAmount)}</td>
                  <td>{formatCurrency(row.remainingAmount)}</td>
                  <td>{row.contributionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Senaste aktivitet</span>
            <h2>Nyast registrerade poster</h2>
          </div>
        </div>
        <div className="history-list">
          {data.recentContributions.map((entry) => (
            <div className="history-item" key={entry.id}>
              <div>
                <strong>
                  {entry.userName} · {entry.title}
                </strong>
                <p>
                  {entry.kindLabel}
                  {entry.note ? ` · ${entry.note}` : ""}
                </p>
              </div>
              <span>{formatCurrency(entry.amount)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

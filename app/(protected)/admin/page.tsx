import {
  createAnnouncementAction,
  createContributionAction,
  createPollAction,
  createStudentAction,
  deleteAnnouncementAction,
  deletePollAction,
  resetPasswordAction,
  updateAnnouncementAction,
  updatePollAction,
} from "@/app/actions";
import { EarningsChart } from "@/components/earnings-chart";
import { ProgressBar } from "@/components/progress-bar";
import { SubmitButton } from "@/components/submit-button";
import { requireRole } from "@/lib/auth";
import { CONTRIBUTION_TYPES, POLL_TYPES, ROLES } from "@/lib/constants";
import { getAdminDashboard } from "@/lib/dashboard";
import { formatCurrency, formatDateLabel } from "@/lib/utils";

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
    case "announcement-saved":
      return { type: "success", text: "Announcement publicerades." };
    case "announcement-updated":
      return { type: "success", text: "Announcement uppdaterades." };
    case "announcement-deleted":
      return { type: "success", text: "Announcement togs bort." };
    case "poll-saved":
      return { type: "success", text: "Omröstningen skapades." };
    case "poll-updated":
      return { type: "success", text: "Omröstningen uppdaterades." };
    case "poll-deleted":
      return { type: "success", text: "Omröstningen togs bort." };
    default:
      break;
  }

  switch (searchParams?.error) {
    case "invalid-transaction":
      return { type: "error", text: "Kunde inte spara transaktionen. Kontrollera fälten." };
    case "invalid-student":
      return { type: "error", text: "Kunde inte skapa eleven. Kontrollera namn, mål och lösenord." };
    case "invalid-password":
      return { type: "error", text: "Det nya lösenordet måste vara minst 3 tecken." };
    case "unknown-student":
      return { type: "error", text: "Den valda eleven hittades inte." };
    case "invalid-announcement":
      return { type: "error", text: "Announcementen behöver rubrik och lite mer text." };
    case "invalid-poll":
      return { type: "error", text: "Kunde inte spara omröstningen. Kontrollera rubrik, text och status." };
    case "poll-options-required":
      return { type: "error", text: "Alternativ-omröstningar måste ha minst två alternativ." };
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
          <h1>Mörkblå kontroll över studentkassan</h1>
          <p>
            Här lägger du in pengar, postar announcements, skapar omröstningar och ser exakt vem som har röstat eller
            skickat in ett förslag.
          </p>
        </div>
        <div className="hero-note">
          <span>Standardlösenord</span>
          <strong>Förnamn i små bokstäver</strong>
          <p>Exempel: `edvin`, `lucas`, `vilma`. Du kan fortfarande byta dem manuellt per elev.</p>
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
          <span className="panel-label">Öppna omröstningar</span>
          <strong className="panel-value">{data.openPollCount}</strong>
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
              <textarea
                name="note"
                placeholder="Valfritt: vad eleven sålde eller varför du justerade något."
                rows={4}
              />
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
              <h2>Adminkontot</h2>
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
              <span className="eyebrow">Announcements</span>
              <h2>Skapa nytt meddelande</h2>
            </div>
          </div>
          <form action={createAnnouncementAction} className="stack">
            <label className="field">
              <span>Rubrik</span>
              <input name="title" placeholder="t.ex. Ny försäljning på fredag" type="text" />
            </label>
            <label className="field">
              <span>Meddelande</span>
              <textarea name="body" placeholder="Skriv allt klassen behöver veta." rows={5} />
            </label>
            <SubmitButton className="button button-primary" pendingLabel="Publicerar...">
              Publicera announcement
            </SubmitButton>
          </form>
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Omröstningar</span>
              <h2>Skapa ny röstning</h2>
            </div>
          </div>
          <form action={createPollAction} className="stack">
            <label className="field">
              <span>Typ</span>
              <select name="type">
                <option value={POLL_TYPES.OPTION}>Alternativ att rösta på</option>
                <option value={POLL_TYPES.SUGGESTION}>Skicka in förslag</option>
              </select>
            </label>
            <label className="field">
              <span>Rubrik</span>
              <input name="title" placeholder="t.ex. Vilken färg ska hoodien ha?" type="text" />
            </label>
            <label className="field">
              <span>Beskrivning</span>
              <textarea name="description" placeholder="Beskriv vad klassen ska ta ställning till." rows={4} />
            </label>
            <label className="field">
              <span>Alternativ (en per rad)</span>
              <textarea
                name="optionsText"
                placeholder={"Flak\nSkiva\nMer merch"}
                rows={4}
              />
            </label>
            <p className="small-text">Alternativen används bara för omröstningar med fasta val.</p>
            <SubmitButton className="button button-primary" pendingLabel="Skapar omröstning...">
              Skapa omröstning
            </SubmitButton>
          </form>
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
              <input name="password" placeholder="t.ex. maja" type="text" />
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
              <input name="password" placeholder="t.ex. viggo" type="text" />
            </label>
            <SubmitButton className="button button-secondary" pendingLabel="Återställer...">
              Återställ lösenord
            </SubmitButton>
          </form>
        </article>
      </section>

      <section className="feed-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Feed</span>
              <h2>Hantera announcements</h2>
            </div>
          </div>
          <div className="feed-list">
            {data.announcements.length === 0 ? (
              <div className="feed-empty">Inga announcements ännu.</div>
            ) : (
              data.announcements.map((announcement) => (
                <article className="announcement-card admin-card" key={announcement.id}>
                  <div className="announcement-meta">
                    <span>{announcement.authorName}</span>
                    <span>{formatDateLabel(announcement.publishedAt)}</span>
                  </div>
                  <form action={updateAnnouncementAction} className="stack">
                    <input name="announcementId" type="hidden" value={announcement.id} />
                    <label className="field">
                      <span>Rubrik</span>
                      <input defaultValue={announcement.title} name="title" type="text" />
                    </label>
                    <label className="field">
                      <span>Meddelande</span>
                      <textarea defaultValue={announcement.body} name="body" rows={4} />
                    </label>
                    <div className="inline-actions">
                      <SubmitButton className="button button-secondary" pendingLabel="Sparar...">
                        Uppdatera
                      </SubmitButton>
                    </div>
                  </form>
                  <form action={deleteAnnouncementAction}>
                    <input name="announcementId" type="hidden" value={announcement.id} />
                    <SubmitButton className="button button-danger" pendingLabel="Tar bort...">
                      Ta bort
                    </SubmitButton>
                  </form>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Omröstningar</span>
              <h2>Hantera omröstningar</h2>
            </div>
          </div>
          <div className="feed-list">
            {data.polls.length === 0 ? (
              <div className="feed-empty">Inga omröstningar ännu.</div>
            ) : (
              data.polls.map((poll) => (
                <article className="poll-card admin-card" key={poll.id}>
                  <div className="poll-topline">
                    <span className={`status-pill ${poll.isOpen ? "open" : "closed"}`}>
                      {poll.isOpen ? "Öppen" : "Stängd"}
                    </span>
                    <span>{formatDateLabel(poll.createdAt)}</span>
                  </div>
                  <form action={updatePollAction} className="stack">
                    <input name="pollId" type="hidden" value={poll.id} />
                    <label className="field">
                      <span>Rubrik</span>
                      <input defaultValue={poll.title} name="title" type="text" />
                    </label>
                    <label className="field">
                      <span>Beskrivning</span>
                      <textarea defaultValue={poll.description} name="description" rows={4} />
                    </label>
                    <label className="field">
                      <span>Status</span>
                      <select defaultValue={String(poll.isOpen)} name="isOpen">
                        <option value="true">Öppen</option>
                        <option value="false">Stängd</option>
                      </select>
                    </label>
                    <div className="inline-actions">
                      <SubmitButton className="button button-secondary" pendingLabel="Sparar...">
                        Uppdatera
                      </SubmitButton>
                    </div>
                  </form>

                  {poll.type === POLL_TYPES.OPTION ? (
                    <div className="poll-options admin-results">
                      {poll.options.map((option) => (
                        <div className="poll-option-row" key={option.id}>
                          <div className="poll-option-label">
                            <span>{option.label}</span>
                            <strong>{option.voteCount} röster</strong>
                          </div>
                          <div className="option-bar">
                            <div style={{ width: `${option.percentage}%` }} />
                          </div>
                          <div className="pill-row">
                            {option.voterNames.length === 0 ? (
                              <span className="small-text">Ingen har röstat här ännu.</span>
                            ) : (
                              option.voterNames.map((voterName) => (
                                <span className="pill" key={`${option.id}-${voterName}`}>
                                  {voterName}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="response-grid">
                      {poll.suggestions.length === 0 ? (
                        <div className="feed-empty">Inga förslag inskickade ännu.</div>
                      ) : (
                        poll.suggestions.map((suggestion) => (
                          <div className="response-item" key={suggestion.id}>
                            <p>{suggestion.text}</p>
                            <span>{suggestion.authorName}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <form action={deletePollAction}>
                    <input name="pollId" type="hidden" value={poll.id} />
                    <SubmitButton className="button button-danger" pendingLabel="Tar bort...">
                      Ta bort omröstning
                    </SubmitButton>
                  </form>
                </article>
              ))
            )}
          </div>
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

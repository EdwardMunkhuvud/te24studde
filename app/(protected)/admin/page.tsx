import Link from "next/link";
import { StudentGallery } from "@/components/student-gallery";
import { getPhotoPage } from "@/lib/student-photos";
import { isR2Configured } from "@/lib/r2";
import { AttachmentPicker } from "@/components/attachment-picker";
import { DeleteButton } from "@/components/delete-button";
import { PollTypeFields } from "@/components/poll-type-fields";
import { ClassList } from "@/components/class-list";
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
import { PageTabs, type PageTabItem } from "@/components/page-tabs";
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
    tab?: string;
  };
};

const ADMIN_TAB_KEYS = ["overview", "money", "announcements", "polls", "accounts", "class", "photos"] as const;

type AdminTab = (typeof ADMIN_TAB_KEYS)[number];

function resolveAdminTab(tab?: string): AdminTab {
  return ADMIN_TAB_KEYS.find((candidate) => candidate === tab) ?? "overview";
}

function bannerFromParams(searchParams: AdminPageProps["searchParams"]) {
  switch (searchParams?.status) {
    case "transaction-saved":
      return { type: "success", text: "Transaktionen sparades." };
    case "student-saved":
      return { type: "success", text: "Ny elev skapades." };
    case "password-reset":
      return { type: "success", text: "Lösenordet återställdes." };
    case "announcement-saved":
      return { type: "success", text: "Meddelandet publicerades." };
    case "announcement-updated":
      return { type: "success", text: "Meddelandet uppdaterades." };
    case "announcement-deleted":
      return { type: "success", text: "Meddelandet togs bort." };
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
      return { type: "error", text: "Meddelandet behöver rubrik och lite mer text." };
    case "invalid-poll":
      return { type: "error", text: "Kunde inte spara omröstningen. Kontrollera rubrik, text och status." };
    case "invalid-attachments":
      return { type: "error", text: "Bilderna kunde inte sparas. Välj högst fyra bilder och försök igen." };
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
  const activeTab = resolveAdminTab(searchParams?.tab);
  const photoPage = activeTab === "photos" ? await getPhotoPage() : null;
  const photoUploadsEnabled = isR2Configured();
  const latestAnnouncement = data.announcements[0] ?? null;
  const adminChartData =
    data.adminSummary?.history.map((point) => ({
      label: point.label,
      total: point.total,
      amount: point.amount,
    })) ?? [];
  const tabs: PageTabItem[] = [
    { key: "overview", label: "Översikt" },
    { key: "photos", label: "Studentbilder" },
    { key: "money", label: "Pengar" },
    { key: "announcements", label: "Meddelanden", badge: data.announcements.length || null },
    { key: "polls", label: "Omröstningar", badge: data.polls.length || null },
    { key: "accounts", label: "Konton" },
    { key: "class", label: "Klassen", badge: data.rows.length || null },
  ];

  return (
    <div className="page-stack">
      <section className={`page-hero ${activeTab !== "overview" ? "page-hero-compact" : ""}`}>
        <div>
          <span className="eyebrow">Adminpanel</span>
          <h1>{activeTab === "overview" ? "Lite ordning. Mer student." : tabs.find((tab) => tab.key === activeTab)?.label}</h1>
          <p>
            Här lägger du in pengar, postar meddelanden, skapar omröstningar och ser exakt vem som har röstat eller
            skickat in ett förslag.
          </p>
        </div>
        <div className="hero-note">
          <span>Standardlösenord</span>
          <strong>Förnamn i små bokstäver</strong>
          <p>Exempel: edvin, lucas, vilma. Du kan fortfarande byta dem manuellt per elev.</p>
        </div>
      </section>

      {banner ? <div role={banner.type === "error" ? "alert" : "status"} className={banner.type === "error" ? "banner danger" : "banner success"}>{banner.text}</div> : null}

      <PageTabs activeTab={activeTab} basePath="/admin" tabs={tabs} />

      {activeTab === "photos" && photoPage ? <StudentGallery initialPage={photoPage} userId={session.userId} admin={true} enabled={photoUploadsEnabled} /> : null}

      {activeTab === "overview" ? (
        <>
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
                  <span className="eyebrow">Din status</span>
                  <h2>Adminkontot</h2>
                </div>
              </div>
              {data.adminSummary ? (
                <>
                  <strong className="panel-value">{formatCurrency(data.adminSummary.totalAmount)}</strong>
                  <p className="panel-subtle">
                    {data.adminSummary.remainingAmount <= 0 ? "Ditt personliga mål är nått — snyggt jobbat!" : `${formatCurrency(data.adminSummary.remainingAmount)} kvar till ditt personliga mål.`}
                  </p>
                  <ProgressBar value={data.adminSummary.progressPercent} />
                  <EarningsChart data={adminChartData} />
                </>
              ) : (
                <p className="panel-subtle">Ingen historik registrerad för adminkontot ännu.</p>
              )}
            </article>

            <article className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Snabbkoll</span>
                  <h2>Klassen just nu</h2>
                </div>
              </div>
              <div className="stack">
                <Link className="info-callout quick-link-card" href="/admin?tab=money">
                  <strong>Registrera nästa bidrag →</strong>
                  <p>Registrera en försäljning, swish eller justering.</p>
                </Link>
                {latestAnnouncement ? (
                  <Link
                    className="announcement-card quick-link-card"
                    href={`/admin?tab=announcements#announcement-${latestAnnouncement.id}`}
                  >
                    <div className="announcement-meta">
                      <span>{latestAnnouncement.authorName}</span>
                      <span>{formatDateLabel(latestAnnouncement.publishedAt)}</span>
                    </div>
                    <h3>{latestAnnouncement.title}</h3>
                    <p>{latestAnnouncement.body}</p>
                  </Link>
                ) : (
                  <div className="feed-empty">Inga meddelanden publicerade ännu.</div>
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {activeTab === "money" ? (
        <section className="dashboard-grid">
          <article className="panel panel-large">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Registrera pengar</span>
                <h2>Lägg till försäljning eller swish</h2>
              </div>
            </div>
            <form action={createContributionAction} className="form-grid">
              <input name="tab" type="hidden" value="money" />
              <label className="field">
                <span>Elev</span>
                <select name="userId" required defaultValue="">
                  <option value="" disabled>Välj en person…</option>
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
                <input required minLength={2} maxLength={60} name="title" placeholder="t.ex. Kakförsäljning vecka 11" type="text" />
              </label>
              <label className="field">
                <span>Belopp i kronor</span>
                <input required step="1" name="amount" placeholder="350" type="number" />
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
                  maxLength={200} name="note"
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
                <span className="eyebrow">Senaste aktivitet</span>
                <h2>Nyast registrerade poster</h2>
              </div>
            </div>
            <div className="history-list">
              {data.recentContributions.length === 0 ? <div className="feed-empty">Inga poster ännu. Registrera klassens första bidrag här bredvid.</div> : null}
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
          </article>
        </section>
      ) : null}

      {activeTab === "announcements" ? (
        <section className="feed-grid">
          <article className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Meddelanden</span>
                <h2>Skapa nytt meddelande</h2>
              </div>
            </div>
            <form key={`new-announcement-${data.announcements.length}`} action={createAnnouncementAction} className="stack">
              <input name="tab" type="hidden" value="announcements" />
              <label className="field">
                <span>Rubrik</span>
                <input required minLength={3} maxLength={100} name="title" placeholder="t.ex. Ny försäljning på fredag" type="text" />
              </label>
              <label className="field">
                <span>Meddelande</span>
                <textarea required minLength={6} maxLength={1200} name="body" placeholder="Skriv allt klassen behöver veta." rows={5} />
              </label>
              <AttachmentPicker enabled={photoUploadsEnabled} />
              <SubmitButton className="button button-primary" pendingLabel="Publicerar...">
                Publicera meddelande
              </SubmitButton>
            </form>
          </article>

          <article className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feed</span>
                <h2>Hantera meddelanden</h2>
              </div>
            </div>
            <div className="feed-list">
              {data.announcements.length === 0 ? (
                <div className="feed-empty">Inga meddelanden ännu.</div>
              ) : (
                data.announcements.map((announcement) => (
                  <article
                    className="announcement-card admin-card jump-target"
                    id={`announcement-${announcement.id}`}
                    key={announcement.id}
                  >
                    <div className="announcement-meta">
                      <span>{announcement.authorName}</span>
                      <span>{formatDateLabel(announcement.publishedAt)}</span>
                    </div>
                    <form action={updateAnnouncementAction} className="stack">
                      <input name="announcementId" type="hidden" value={announcement.id} />
                      <input name="tab" type="hidden" value="announcements" />
                      <label className="field">
                        <span>Rubrik</span>
                        <input defaultValue={announcement.title} required minLength={3} maxLength={100} name="title" type="text" />
                      </label>
                      <label className="field">
                        <span>Meddelande</span>
                        <textarea defaultValue={announcement.body} required minLength={6} maxLength={1200} name="body" rows={4} />
                      </label>
                      <AttachmentPicker enabled={photoUploadsEnabled} initialPhotos={announcement.photos} />
                      <div className="inline-actions">
                        <SubmitButton className="button button-secondary" pendingLabel="Sparar...">
                          Uppdatera
                        </SubmitButton>
                      </div>
                    </form>
                    <form action={deleteAnnouncementAction}>
                      <input name="announcementId" type="hidden" value={announcement.id} />
                      <input name="tab" type="hidden" value="announcements" />
                      <DeleteButton warning="Ta bort meddelandet? Det försvinner för hela klassen och går inte att ångra." />
                    </form>
                  </article>
                ))
              )}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "polls" ? (
        <section className="feed-grid">
          <article className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Omröstningar</span>
                <h2>Skapa ny omröstning</h2>
              </div>
            </div>
            <form key={`new-poll-${data.polls.length}`} action={createPollAction} className="stack">
              <input name="tab" type="hidden" value="polls" />
              <PollTypeFields />
              <label className="field">
                <span>Rubrik</span>
                <input required minLength={3} maxLength={100} name="title" placeholder="t.ex. Vilken färg ska hoodien ha?" type="text" />
              </label>
              <label className="field">
                <span>Beskrivning</span>
                <textarea required minLength={6} maxLength={1200} name="description" placeholder="Beskriv vad klassen ska ta ställning till." rows={4} />
              </label>

              <AttachmentPicker enabled={photoUploadsEnabled} />
              <SubmitButton className="button button-primary" pendingLabel="Skapar omröstning...">
                Skapa omröstning
              </SubmitButton>
            </form>
          </article>

          <article className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Hantera</span>
                <h2>Alla omröstningar</h2>
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
                      <input name="tab" type="hidden" value="polls" />
                      <label className="field">
                        <span>Rubrik</span>
                        <input defaultValue={poll.title} required minLength={3} maxLength={100} name="title" type="text" />
                      </label>
                      <label className="field">
                        <span>Beskrivning</span>
                        <textarea defaultValue={poll.description} required minLength={6} maxLength={1200} name="description" rows={4} />
                      </label>
                      <label className="field">
                        <span>Status</span>
                        <select defaultValue={String(poll.isOpen)} name="isOpen">
                          <option value="true">Öppen</option>
                          <option value="false">Stängd</option>
                        </select>
                      </label>
                      <AttachmentPicker enabled={photoUploadsEnabled} initialPhotos={poll.photos} />
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
                              <strong>{option.voteCount} {option.voteCount === 1 ? "röst" : "röster"}</strong>
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
                      <input name="tab" type="hidden" value="polls" />
                      <DeleteButton label="Ta bort omröstning" warning="Ta bort omröstningen och alla svar? Det går inte att ångra." />
                    </form>
                  </article>
                ))
              )}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "accounts" ? (
        <section className="dashboard-grid">
          <article className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Nya elever</span>
                <h2>Lägg till elevkonto</h2>
              </div>
            </div>
            <form action={createStudentAction} className="stack">
              <input name="tab" type="hidden" value="accounts" />
              <label className="field">
                <span>Fullständigt namn</span>
                <input required minLength={4} maxLength={80} name="name" placeholder="Förnamn Efternamn" type="text" />
              </label>
              <label className="field">
                <span>Startlösenord</span>
                <input required minLength={3} maxLength={100} autoComplete="new-password" name="password" placeholder="t.ex. maja" type="text" />
              </label>
              <label className="field">
                <span>Mål i kronor</span>
                <input defaultValue="1050" required min="0" max="50000" step="1" name="targetAmount" type="number" />
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
              <input name="tab" type="hidden" value="accounts" />
              <label className="field">
                <span>Välj elev</span>
                <select name="userId" required defaultValue="">
                  <option value="" disabled>Välj en person…</option>
                  {data.userOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Nytt lösenord</span>
                <input required minLength={3} maxLength={100} autoComplete="new-password" name="password" placeholder="t.ex. viggo" type="text" />
              </label>
              <SubmitButton className="button button-secondary" pendingLabel="Återställer...">
                Återställ lösenord
              </SubmitButton>
            </form>
          </article>
        </section>
      ) : null}

      {activeTab === "class" ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Överblick</span>
              <h2>Alla elever och deras totalsummor</h2>
            </div>
          </div>
          <ClassList rows={data.rows} currentUserId={session.userId} admin />

        </section>
      ) : null}
    </div>
  );
}

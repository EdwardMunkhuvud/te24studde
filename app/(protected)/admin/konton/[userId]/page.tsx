import Link from "next/link";
import { notFound } from "next/navigation";

import { createAccountContributionAction, updateContributionAction } from "@/app/actions";
import { ContributionFields } from "@/components/contribution-fields";
import { SubmitButton } from "@/components/submit-button";
import styles from "@/components/admin-sales.module.css";
import { requireRole } from "@/lib/auth";
import { CONTRIBUTION_TYPES, ROLES, type ContributionType } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { contributionTypeLabel, formatCurrency } from "@/lib/utils";

const statuses: Record<string, string> = {
  "transaction-saved": "Posten sparades.",
  "transaction-updated": "Posten uppdaterades.",
};
const errors: Record<string, string> = {
  "invalid-transaction": "Kontrollera rubrik, belopp i hela kronor och datum.",
  "transaction-changed": "Posten har ändrats. Kontrollera den aktuella historiken.",
  "unknown-student": "Kontot hittades inte.",
};
const dateFormat = new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeZone: "Europe/Stockholm" });

export default async function AccountHistoryPage({
  params, searchParams,
}: {
  params: { userId: string };
  searchParams?: { status?: string; error?: string };
}) {
  await requireRole(ROLES.ADMIN);

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      contributions: {
        orderBy: [{ occurredAt: "desc" }, { sortOrder: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      },
    },
  });
  if (!user) notFound();

  const total = user.contributions.reduce((sum, entry) => sum + entry.amount, 0);
  const sales = user.contributions.reduce((sum, entry) => (
    entry.kind === CONTRIBUTION_TYPES.SALE ? sum + entry.amount : sum
  ), 0);
  const status = searchParams?.status;
  const error = searchParams?.error;
  const statusMessage = status && Object.hasOwn(statuses, status) ? statuses[status] : null;
  const errorMessage = error && Object.hasOwn(errors, error) ? errors[error] : null;

  return (
    <div className="page-stack">
      <nav aria-label="Tillbaka till admin" className="inline-actions">
        <Link className="button button-secondary" href="/admin?tab=accounts">← Konton</Link>
        <Link className="button button-secondary" href="/admin?tab=money">Pengar</Link>
      </nav>

      <section className="page-hero page-hero-compact">
        <div>
          <span className="eyebrow">Kontohistorik</span>
          <h1>{user.name}</h1>
          <p>{user.username}{user.role === ROLES.ADMIN ? " · Admin" : ""}</p>
        </div>
      </section>

      {errorMessage ? <div className="banner danger" role="alert">{errorMessage}</div> : null}
      {statusMessage ? <div className="banner success" role="status">{statusMessage}</div> : null}

      <section className={styles.totals} aria-label="Kontots saldon">
        <article className="panel">
          <span className="panel-label">Insamlat totalt</span>
          <strong className="panel-value">{formatCurrency(total)}</strong>
        </article>
        <article className="panel">
          <span className="panel-label">Försäljning</span>
          <strong className="panel-value">{formatCurrency(sales)}</strong>
        </article>
      </section>

      <section className="panel stack">
        <div className="section-heading">
          <div>
            <h2>Fullständig historik</h2>
            <p className="small-text">{user.contributions.length} poster</p>
          </div>
          <a className="button button-secondary" href="#lagg-till">Lägg till post</a>
        </div>
        {user.contributions.length === 0 ? <p className="feed-empty">Här visas kontots första post när du sparat den.</p> : null}

        {user.contributions.map((entry) => {
          const updatedAt = entry.updatedAt.toISOString();
          return (
            <details className={styles.historyEntry} key={`${entry.id}-${updatedAt}`}>
              <summary>
                <span className={styles.entryTitle}>
                  <strong>{entry.title}</strong>
                  <span className="small-text">
                    {contributionTypeLabel(entry.kind as ContributionType)}
                    {` · ${entry.occurredAt ? dateFormat.format(entry.occurredAt) : "Utan datum"}`}
                  </span>
                </span>
                <strong>{formatCurrency(entry.amount)}</strong>
                <span className={styles.editLabel}>Ändra</span>
              </summary>
              <div className={styles.entryForm}>
                {entry.periodLabel && entry.periodLabel !== entry.title ? (
                  <p className="small-text">Etikett i historiken: {entry.periodLabel}</p>
                ) : null}
                <form action={updateContributionAction.bind(null, user.id)} className="form-grid">
                  <input type="hidden" name="contributionId" value={entry.id} />
                  <input type="hidden" name="updatedAt" value={updatedAt} />
                  <ContributionFields entry={entry} />
                  <div className="form-footer">
                    <p className="small-text">Sätt beloppet till 0 kr om posten inte ska påverka saldot.</p>
                    <SubmitButton className="button button-primary">Spara ändringar</SubmitButton>
                  </div>
                </form>
              </div>
            </details>
          );
        })}
      </section>

      <section className="panel stack jump-target" id="lagg-till">
        <h2>Lägg till post för {user.name}</h2>
        <form action={createAccountContributionAction.bind(null, user.id)} className="form-grid">
          <ContributionFields />
          <div className="form-footer">
            <SubmitButton className="button button-primary">Spara post</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}

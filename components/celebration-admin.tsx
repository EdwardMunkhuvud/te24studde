import Link from "next/link";
import { redirect } from "next/navigation";

import { manageCelebrationSurvey } from "@/app/(protected)/celebration-actions";
import { CelebrationForm } from "@/components/celebration-survey";
import { SubmitButton } from "@/components/submit-button";
import {
  CELEBRATION_FOLLOW_UP_LIMIT,
  celebrationChoices,
  celebrationPath,
  getCelebrationParticipants,
  getCelebrationSettings,
  hasCelebrationFollowUp,
} from "@/lib/celebration-survey";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

import styles from "./celebration-survey.module.css";

const messages: Record<string, string> = {
  configured: "Utkastet sparades.",
  opened: "Formuläret är öppet och visas för klassen i Studde.",
  closed: "Formuläret stängdes. Svaren finns kvar här.",
  invalid: "Åtgärden kunde inte genomföras. Kontrollera beloppet och formulärets status.",
  retry: "Ändringen kunde inte sparas. Försök igen.",
};

const ownEmptyResponse = { collected: 900, payment: null, attendance: null, idea: null, submittedAt: null };
const adminPath = celebrationPath(ROLES.ADMIN);

function choiceLabel(value: string | null) {
  return value ? celebrationChoices[value as keyof typeof celebrationChoices] ?? "—" : "—";
}

export async function CelebrationAdmin({ userId, view, status }: {
  userId: string;
  view?: string;
  status?: string;
}) {
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (admin?.role !== ROLES.ADMIN) redirect("/");

  const settings = await getCelebrationSettings();
  const isDraft = !settings || settings.status === "draft";
  const isOpen = settings?.status === "open";
  const message = status && Object.prototype.hasOwnProperty.call(messages, status) ? messages[status] : null;

  if (view === "own") {
    const own = !isDraft && await prisma.celebrationResponse.findUnique({ where: { userId } });
    if (!settings || !own) redirect(adminPath);
    return (
      <>
        <Link href={adminPath} className="text-link">Till formulärets översikt</Link>
        <CelebrationForm response={own} surplus={settings.surplus} open={isOpen} status={status} />
      </>
    );
  }

  const rows = isDraft ? [] : await prisma.celebrationResponse.findMany({
    include: { user: { select: { name: true } } },
  });
  const participants = isDraft ? await getCelebrationParticipants() : rows;
  const followUpCount = participants.filter(({ collected }) => hasCelebrationFollowUp(collected)).length;
  const responses = rows.filter(({ submittedAt }) => submittedAt)
    .sort((left, right) => left.user.name.localeCompare(right.user.name, "sv"));
  const error = status === "invalid" || status === "retry";

  return (
    <section className={styles.survey} aria-labelledby="celebration-admin-heading">
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1 id="celebration-admin-heading">Formulär för studentfirandet</h1>
          <p>{participants.length} i klassen får fritextfrågan. {followUpCount} som har samlat in under {formatCurrency(CELEBRATION_FOLLOW_UP_LIMIT)} får också följdfrågorna.</p>
        </div>
        <div className={styles.surplus}><span>Status</span><strong>{isDraft ? "Utkast" : isOpen ? "Öppet" : "Stängt"}</strong></div>
      </header>

      {message && <p className={error ? "banner danger" : "banner success"} role={error ? "alert" : "status"}>{message}</p>}

      <section className={styles.card} aria-labelledby="celebration-settings-heading">
        <h2 id="celebration-settings-heading">{isDraft ? "Gör formuläret klart" : "Hantera formuläret"}</h2>
        {isDraft ? (
          <>
            <form action={manageCelebrationSurvey} className={styles.settingsForm}>
              <input type="hidden" name="intent" value="save" />
              <label className="field">
                <span>Beräknat överskott i kronor</span>
                <input type="number" name="surplus" required min={0} max={2_147_483_647} step={1} defaultValue={settings?.surplus} />
              </label>
              <SubmitButton>Spara utkast</SubmitButton>
            </form>
            <p>Insamlade belopp hämtas från klasskassan när du öppnar formuläret. Då visas det för klassen i fliken Studentformulär.</p>
          </>
        ) : <p>Beräknat överskott för klassen är {formatCurrency(settings.surplus)}.</p>}
        <div className={styles.adminActions}>
          {settings && (
            <form action={manageCelebrationSurvey}>
              <input type="hidden" name="intent" value={isOpen ? "close" : "open"} />
              <SubmitButton className="button button-secondary">{isOpen ? "Stäng formuläret" : isDraft ? "Öppna för klassen" : "Öppna igen"}</SubmitButton>
            </form>
          )}
          {!isDraft && <Link href={adminPath + "&view=own"} className="text-link">Mitt eget svar</Link>}
        </div>
      </section>

      {isDraft && settings && (
        <details className={styles.preview}>
          <summary>Förhandsgranska elevvyn med följdfrågor</summary>
          <CelebrationForm response={ownEmptyResponse} surplus={settings.surplus} open={false} preview />
        </details>
      )}

      {!isDraft && (
        <section className={styles.card} aria-labelledby="celebration-responses-heading">
          <h2 id="celebration-responses-heading">Privata svar · {responses.length} av {rows.length}</h2>
          {responses.length === 0 ? <p>Inga svar har kommit in än.</p> : (
            <div className={styles.responses}>
              {responses.map((response) => (
                <article className={styles.response} key={response.userId}>
                  <h3>{response.user.name}</h3>
                  {hasCelebrationFollowUp(response.collected) && (
                    <dl>
                      <div><dt>Kan betala resten</dt><dd>{choiceLabel(response.payment)}</dd></div>
                      <div><dt>Vill vara med</dt><dd>{choiceLabel(response.attendance)}</dd></div>
                    </dl>
                  )}
                  {response.idea && <p>{response.idea}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}

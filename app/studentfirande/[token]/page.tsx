import type { Metadata } from "next";
import { notFound } from "next/navigation";

import "@/app/normal.css";
import { CelebrationForm, CelebrationHeader } from "@/components/celebration-survey";
import styles from "@/components/celebration-survey.module.css";
import {
  celebrationAccessToken,
  celebrationGroupPath,
  getCelebrationSettings,
  hasCelebrationFollowUp,
} from "@/lib/celebration-survey";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Så firar vi studenten · Studde",
  description: "TE24:s formulär inför studentfirandet.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: { token: string };
  searchParams?: { namn?: string; survey?: string };
};

export default async function CelebrationGroupPage({ params, searchParams }: PageProps) {
  const group = celebrationAccessToken.safeParse(params.token);
  if (!group.success) notFound();

  const settings = await getCelebrationSettings();
  if (!settings || settings.groupToken !== group.data || settings.status === "draft") notFound();

  const path = celebrationGroupPath(group.data);
  const selection = celebrationAccessToken.safeParse(searchParams?.namn);
  const open = settings.status === "open";
  const saved = searchParams?.survey === "saved";

  const participant = open && !saved && selection.success ? await prisma.celebrationResponse.findUnique({
    where: { accessToken: selection.data },
    select: { accessToken: true, collected: true, submittedAt: true, user: { select: { name: true } } },
  }) : null;

  const choices = open && !saved && !participant ? await prisma.celebrationResponse.findMany({
    select: { accessToken: true, user: { select: { name: true } } },
  }) : [];
  choices.sort((left, right) => left.user.name.localeCompare(right.user.name, "sv"));

  return (
    <div className="dashboard-page normal-site">
      <main className="dashboard-shell">
        {participant && !participant.submittedAt ? (
          <CelebrationForm
            followUp={hasCelebrationFollowUp(participant.collected)}
            surplus={settings.surplus}
            participant={{ name: participant.user.name, token: participant.accessToken, groupToken: group.data }}
            status={searchParams?.survey}
          />
        ) : (
          <section className={styles.survey} aria-labelledby="celebration-heading">
            <CelebrationHeader surplus={settings.surplus} />
            {!open ? (
              <p className="banner" role="status">Formuläret är stängt för nya svar.</p>
            ) : saved ? (
              <p className="banner success" role="status">Tack! Ditt svar har sparats.</p>
            ) : participant ? (
              <div className={styles.card}>
                <h2>Svar redan inskickat</h2>
                <p>Det finns redan ett svar för {participant.user.name}. Kontakta klassens administratör om du behöver rätta det.</p>
                <a className={styles.backLink} href={path}>Välj ett annat namn</a>
              </div>
            ) : (
              <form className={styles.card} action={path} method="get">
                <h2>Vem svarar?</h2>
                {searchParams?.namn && <p role="alert">Välj ditt namn i listan för att fortsätta.</p>}
                <label className="field">
                  <span>Ditt namn</span>
                  <select name="namn" defaultValue="" required>
                    <option value="" disabled>Välj ditt namn</option>
                    {choices.map((choice) => <option key={choice.accessToken} value={choice.accessToken}>{choice.user.name}</option>)}
                  </select>
                </label>
                <div><button type="submit" className="button button-primary">Fortsätt till frågorna</button></div>
              </form>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

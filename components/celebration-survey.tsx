import type { CelebrationResponse } from "@prisma/client";
import { CheckCircle2, GraduationCap, Lightbulb, PartyPopper, Wallet } from "lucide-react";

import { saveCelebrationResponse } from "@/app/(protected)/celebration-actions";
import { SubmitButton } from "@/components/submit-button";
import {
  CELEBRATION_GOAL,
  CELEBRATION_IDEA_LIMIT,
  celebrationChoices,
  hasCelebrationFollowUp,
} from "@/lib/celebration-survey";
import { formatCurrency } from "@/lib/utils";

import styles from "./celebration-survey.module.css";

type OwnResponse = Pick<CelebrationResponse, "collected" | "payment" | "attendance" | "idea" | "submittedAt">;

const messages: Record<string, string> = {
  saved: "Ditt svar har sparats. Tack för att du svarade!",
  invalid: "Kontrollera att du har svarat på båda följdfrågorna och att ditt förslag ryms i fritextfältet.",
  unavailable: "Formuläret är inte öppet för svar just nu.",
  retry: "Ditt svar kunde inte sparas. Försök igen.",
};

function Choices({ name, question, value }: { name: string; question: string; value: string | null }) {
  return (
    <fieldset className={styles.choices}>
      <legend>{question}</legend>
      <div className={styles.choiceRow}>
        {Object.entries(celebrationChoices).map(([key, label]) => (
          <label key={key} className={styles.choice}>
            <input type="radio" name={name} value={key} defaultChecked={key === value} required />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CelebrationForm({ response, surplus, open, preview = false, status }: {
  response: OwnResponse;
  surplus: number;
  open: boolean;
  preview?: boolean;
  status?: string;
}) {
  const followUp = hasCelebrationFollowUp(response.collected);
  const canSubmit = open && !preview;
  const message = status && Object.prototype.hasOwnProperty.call(messages, status) ? messages[status] : null;
  const remaining = CELEBRATION_GOAL - response.collected;

  return (
    <section className={styles.survey} aria-labelledby="celebration-heading">
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <GraduationCap size={31} aria-hidden="true" />
          <h1 id="celebration-heading">Så firar vi studenten</h1>
          <p>Sista säljrundan är klar! Tack för allt ni har gjort för klasskassan. Nu planerar vi firandet tillsammans.</p>
        </div>
        <div className={styles.surplus}>
          <span>Beräknat överskott</span>
          <strong>ca {formatCurrency(surplus)}</strong>
        </div>
      </header>

      {message && <p className={status === "saved" ? "banner success" : "banner danger"} role={status === "saved" ? "status" : "alert"}>{message}</p>}
      {!open && !preview && <p className="banner" role="status">Formuläret är stängt för nya svar.</p>}

      <form action={canSubmit ? saveCelebrationResponse : undefined} className={styles.form}>
        <fieldset disabled={!canSubmit} className={styles.questions} aria-label="Frågor om studentfirandet">
          {followUp && (
            <section className={styles.card} aria-labelledby="celebration-followup">
              <div className={styles.cardTitle}>
                <span className={styles.icon}><Wallet size={21} aria-hidden="true" /></span>
                <h2 id="celebration-followup">Ditt bidrag och deltagande</h2>
              </div>
              <p>Du har samlat in <strong>{formatCurrency(response.collected)}</strong>. Det är <strong>{formatCurrency(remaining)}</strong> kvar till det gemensamma målet på {formatCurrency(CELEBRATION_GOAL)} per person.</p>
              <Choices name="payment" question={`Har du möjlighet att betala in de ${formatCurrency(remaining)} som återstår?`} value={response.payment} />
              <Choices name="attendance" question="Vill du fortfarande vara med på studentfirandet?" value={response.attendance} />
            </section>
          )}

          <section className={styles.card} aria-labelledby="celebration-idea-label">
            <div className={styles.cardTitle}>
              <span className={styles.icon}><Lightbulb size={21} aria-hidden="true" /></span>
              <h2 id="celebration-idea-label"><label htmlFor="celebration-idea">Vad vill du att de cirka {formatCurrency(surplus)} som blir över ska gå till?</label></h2>
            </div>
            <p id="celebration-examples">Till exempel klassmiddag, musik eller dekorationer till flaket, en fotograf eller en gemensam aktivitet innan studenten. Skriv gärna vad du helst skulle prioritera.</p>
            <div className="field">
              <textarea id="celebration-idea" name="idea" rows={4} maxLength={CELEBRATION_IDEA_LIMIT} placeholder="Jag skulle gärna vilja att vi lägger pengarna på …" defaultValue={response.idea ?? ""} aria-describedby="celebration-examples celebration-optional" />
              <span className="small-text" id="celebration-optional">Frivilligt. Har du flera idéer får du gärna skriva alla.</span>
            </div>
          </section>
        </fieldset>

        {canSubmit && (
          <footer className={styles.footer}>
            <div>
              <p>Dina svar syns för Studdes administratörer.</p>
              {response.submittedAt && <p className={styles.answered}><CheckCircle2 size={16} aria-hidden="true" /> Du kan ändra ditt svar så länge formuläret är öppet.</p>}
            </div>
            <SubmitButton>{response.submittedAt ? "Spara ändringar" : "Skicka svar"} <PartyPopper size={17} aria-hidden="true" /></SubmitButton>
          </footer>
        )}
      </form>
    </section>
  );
}

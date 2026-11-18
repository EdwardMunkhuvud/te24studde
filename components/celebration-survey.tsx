import { GraduationCap, Lightbulb, PartyPopper, Wallet } from "lucide-react";

import { saveCelebrationResponse } from "@/app/studentfirande/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  CELEBRATION_GOAL,
  CELEBRATION_IDEA_LIMIT,
  celebrationChoices,
  celebrationGroupPath,
} from "@/lib/celebration-survey";
import { formatCurrency } from "@/lib/utils";

import styles from "./celebration-survey.module.css";

type Participant = { name: string; token: string; groupToken: string };

const messages: Record<string, string> = {
  invalid: "Kontrollera att du har besvarat de obligatoriska frågorna och att förslaget ryms i fritextfältet.",
  unavailable: "Formuläret är inte öppet för svar just nu.",
  retry: "Ditt svar kunde inte sparas. Försök igen.",
};

function Choices({ name, question }: { name: string; question: string }) {
  return (
    <fieldset className={styles.choices}>
      <legend>{question}</legend>
      <div className={styles.choiceRow}>
        {Object.entries(celebrationChoices).map(([key, label]) => (
          <label key={key} className={styles.choice}>
            <input type="radio" name={name} value={key} required />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CelebrationHeader({ surplus }: { surplus: number }) {
  return (
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
  );
}

export function CelebrationForm({ followUp, surplus, participant, status }: {
  followUp: boolean;
  surplus: number;
  participant?: Participant;
  status?: string;
}) {
  const message = status && Object.prototype.hasOwnProperty.call(messages, status) ? messages[status] : null;

  return (
    <section className={styles.survey} aria-labelledby="celebration-heading">
      <CelebrationHeader surplus={surplus} />

      {participant && (
        <div className={styles.participant}>
          <p>Du svarar som <strong>{participant.name}</strong>.</p>
          <a className={styles.backLink} href={celebrationGroupPath(participant.groupToken)}>Byt namn</a>
        </div>
      )}

      {message && <p className="banner danger" role="alert">{message}</p>}

      <form action={participant ? saveCelebrationResponse : undefined} className={styles.form}>
        {participant && (
          <>
            <input type="hidden" name="groupToken" value={participant.groupToken} />
            <input type="hidden" name="participantToken" value={participant.token} />
          </>
        )}
        <fieldset disabled={!participant} className={styles.questions} aria-label="Frågor om studentfirandet">
          {followUp && (
            <section className={styles.card} aria-labelledby="celebration-followup">
              <div className={styles.cardTitle}>
                <span className={styles.icon}><Wallet size={21} aria-hidden="true" /></span>
                <h2 id="celebration-followup">Ditt bidrag och deltagande</h2>
              </div>
              <Choices name="payment" question={`Har du möjlighet att betala in det som återstår till målet på ${formatCurrency(CELEBRATION_GOAL)}?`} />
              <Choices name="attendance" question="Vill du fortfarande vara med på studentfirandet?" />
            </section>
          )}

          <section className={styles.card} aria-labelledby="celebration-idea-label">
            <div className={styles.cardTitle}>
              <span className={styles.icon}><Lightbulb size={21} aria-hidden="true" /></span>
              <h2 id="celebration-idea-label"><label htmlFor="celebration-idea">Vad vill du att de cirka {formatCurrency(surplus)} som blir över ska gå till?</label></h2>
            </div>
            <p id="celebration-examples">Till exempel klassmiddag, musik eller dekorationer till flaket, en fotograf eller en gemensam aktivitet innan studenten. Skriv gärna vad du helst skulle prioritera.</p>
            <div className="field">
              <textarea id="celebration-idea" name="idea" rows={4} maxLength={CELEBRATION_IDEA_LIMIT} placeholder="Jag skulle gärna vilja att vi lägger pengarna på …" aria-describedby="celebration-examples celebration-optional" />
              <span className="small-text" id="celebration-optional">Frivilligt. Har du flera idéer får du gärna skriva alla.</span>
            </div>
          </section>
        </fieldset>

        {participant && (
          <footer className={styles.footer}>
            <div>
              <p>Dina svar syns för Studdes administratörer. Kontrollera ditt namn innan du skickar.</p>
            </div>
            <SubmitButton>Skicka svar <PartyPopper size={17} aria-hidden="true" /></SubmitButton>
          </footer>
        )}
      </form>
    </section>
  );
}

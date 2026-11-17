import type { Contribution } from "@prisma/client";

import { CONTRIBUTION_TYPES } from "@/lib/constants";
import { contributionTypeLabel } from "@/lib/utils";

type Fields = Pick<Contribution, "title" | "amount" | "kind" | "occurredAt" | "note">;

export function ContributionFields({ entry }: { entry?: Fields }) {
  return (
    <>
      <label className="field">
        <span>Rubrik</span>
        <input required minLength={2} maxLength={60} name="title" placeholder="t.ex. Kakförsäljning vecka 11" type="text" defaultValue={entry?.title} />
      </label>
      <label className="field">
        <span>Belopp i kronor</span>
        <input required step="1" min={-2147483648} max={2147483647} name="amount" placeholder="350" type="number" defaultValue={entry?.amount} />
      </label>
      <label className="field">
        <span>Typ</span>
        <select name="kind" defaultValue={entry?.kind ?? CONTRIBUTION_TYPES.SALE}>
          {Object.values(CONTRIBUTION_TYPES).map((kind) => (
            <option key={kind} value={kind}>{contributionTypeLabel(kind)}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Datum</span>
        <input name="occurredAt" type="date" defaultValue={entry?.occurredAt?.toISOString().slice(0, 10)} />
      </label>
      <label className="field field-wide">
        <span>Anteckning</span>
        <textarea maxLength={200} name="note" defaultValue={entry?.note ?? ""} rows={2} />
      </label>
    </>
  );
}

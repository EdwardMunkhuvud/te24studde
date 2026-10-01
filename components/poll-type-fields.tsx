"use client";

import { useState } from "react";
import { POLL_TYPES } from "@/lib/constants";

export function PollTypeFields() {
  const [type, setType] = useState<string>(POLL_TYPES.OPTION);
  return <>
    <label className="field"><span>Typ</span><select name="type" value={type} onChange={(event) => setType(event.target.value)}><option value={POLL_TYPES.OPTION}>Alternativ att rösta på</option><option value={POLL_TYPES.SUGGESTION}>Skicka in förslag</option></select></label>
    {type === POLL_TYPES.OPTION ? <label className="field"><span>Alternativ (ett per rad)</span><textarea name="optionsText" required placeholder={"Flak\nSkiva\nMer merch"} rows={4} /><small className="small-text">Skriv minst två olika alternativ.</small></label> : <p className="info-callout small-text">Eleverna skriver egna förslag. Andra elever ser dem utan namn; du som admin ser vem som skickat in dem.</p>}
  </>;
}

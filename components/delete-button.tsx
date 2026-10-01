"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

export function DeleteButton({ label = "Ta bort", warning }: { label?: string; warning: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return <button className="button button-delete" type="button" onClick={() => setConfirming(true)}>{label}</button>;
  return <div className="delete-confirm"><p role="alert">{warning}</p><div className="inline-actions"><SubmitButton className="button button-danger" pendingLabel="Tar bort…">Ja, ta bort</SubmitButton><button type="button" className="button button-secondary" onClick={() => setConfirming(false)}>Avbryt</button></div></div>;
}

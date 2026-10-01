"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function LoginFields() {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  return (
    <>
      <label className="field">
        <span>Användarnamn</span>
        <input autoComplete="username" autoCapitalize="none" spellCheck={false} name="username" placeholder="förnamn.efternamn" required type="text" />
      </label>
      <div className="field">
        <label htmlFor="login-password">Lösenord</label>
        <div className="password-field">
          <input id="login-password" autoComplete="current-password" name="password" placeholder="Ditt lösenord" required type={visible ? "text" : "password"} onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)} />
          <button type="button" className="password-toggle" aria-label={visible ? "Dölj lösenord" : "Visa lösenord"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={20} /> : <Eye size={20} />}</button>
        </div>
        {capsLock ? <p className="small-text" role="status">Caps Lock är på.</p> : null}
      </div>
    </>
  );
}

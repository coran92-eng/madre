"use client";

import { useFormState, useFormStatus } from "react-dom";
import { changePassword } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Cambiar contraseña"}</button>;
}

export default function AccountForm() {
  const [state, action] = useFormState(changePassword, {});
  return (
    <form action={action} className="card p-4 space-y-3 max-w-md">
      <div>
        <label className="label" htmlFor="current">Contraseña actual</label>
        <input id="current" name="current" type="password" className="input" autoComplete="current-password" required />
      </div>
      <div>
        <label className="label" htmlFor="next">Nueva contraseña</label>
        <input id="next" name="next" type="password" className="input" autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Repetir nueva contraseña</label>
        <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Contraseña actualizada.</p>}
      <Submit />
    </form>
  );
}

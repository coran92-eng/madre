"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export default function LoginForm() {
  const [state, action] = useFormState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="card p-6 space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" className="input" required autoComplete="current-password" />
      </div>
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">{state.error}</p>
      )}
      <Submit />
      <p className="text-xs text-stone-400 text-center">
        Acceso individual. La sesión caduca por seguridad.
      </p>
    </form>
  );
}

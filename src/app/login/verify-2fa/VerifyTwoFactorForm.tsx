"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { verifyTwoFactor, type VerifyTwoFactorState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Verificando…" : "Verificar"}
    </button>
  );
}

export default function VerifyTwoFactorForm({ email }: { email: string }) {
  const [state, action] = useFormState<VerifyTwoFactorState, FormData>(verifyTwoFactor, {});
  const [useBackup, setUseBackup] = useState(false);

  return (
    <form action={action} className="card p-6 space-y-4">
      <p className="text-sm text-stone-500">
        Sesión de <strong>{email}</strong>. Introduce el código de verificación en dos pasos.
      </p>
      <div>
        <label className="label" htmlFor="code">
          {useBackup ? "Código de respaldo" : "Código de la app autenticadora"}
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          maxLength={useBackup ? 9 : 6}
          placeholder={useBackup ? "XXXX-XXXX" : "123456"}
          className="input"
          required
          autoFocus
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">{state.error}</p>
      )}
      <Submit />
      <button
        type="button"
        className="block w-full text-center text-sm text-stone-500 hover:underline"
        onClick={() => setUseBackup((v) => !v)}
      >
        {useBackup ? "Usar código de la app autenticadora" : "Usar un código de respaldo"}
      </button>
    </form>
  );
}

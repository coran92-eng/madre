"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { resetPassword } from "./actions";

function Sub() {
  const { pending } = useFormStatus();
  return <button className="btn-primary w-full" disabled={pending}>{pending ? "Guardando…" : "Restablecer contraseña"}</button>;
}

function ResetInner() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action] = useFormState(resetPassword, {});

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-serif font-bold text-madre">MADRE</h1>
          <p className="text-stone-500 text-sm mt-1">Nueva contraseña</p>
        </div>
        {state.ok ? (
          <div className="card p-6 text-center">
            <p className="text-green-700">Contraseña actualizada. Ya puedes acceder.</p>
            <Link href="/login" className="btn-primary mt-4 inline-flex">Ir al acceso</Link>
          </div>
        ) : !token ? (
          <div className="card p-6 text-center text-stone-600">
            Falta el token del enlace. <Link href="/forgot" className="underline">Solicitar uno nuevo</Link>.
          </div>
        ) : (
          <form action={action} className="card p-6 space-y-4">
            <input type="hidden" name="token" value={token} />
            <div>
              <label className="label" htmlFor="password">Nueva contraseña</label>
              <input id="password" name="password" type="password" className="input" minLength={8} required autoComplete="new-password" />
            </div>
            <div>
              <label className="label" htmlFor="confirm">Repetir contraseña</label>
              <input id="confirm" name="confirm" type="password" className="input" required autoComplete="new-password" />
            </div>
            {state.error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">{state.error}</p>}
            <Sub />
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}

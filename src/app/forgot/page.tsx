"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { requestPasswordReset } from "./actions";

function Sub() {
  const { pending } = useFormStatus();
  return <button className="btn-primary w-full" disabled={pending}>{pending ? "Enviando…" : "Enviar enlace"}</button>;
}

export default function ForgotPage() {
  const [state, action] = useFormState(requestPasswordReset, {});
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-serif font-bold text-madre">MADRE</h1>
          <p className="text-stone-500 text-sm mt-1">Recuperar contraseña</p>
        </div>
        {state.ok ? (
          <div className="card p-6 text-center">
            <p className="text-stone-700">Si el email existe, te hemos enviado un enlace para restablecer la contraseña (válido 1 hora).</p>
            <Link href="/login" className="btn-secondary mt-4 inline-flex">Volver</Link>
          </div>
        ) : (
          <form action={action} className="card p-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="input" required autoComplete="email" />
            </div>
            <Sub />
            <Link href="/login" className="block text-center text-sm text-stone-500 hover:underline">Volver al acceso</Link>
          </form>
        )}
      </div>
    </main>
  );
}

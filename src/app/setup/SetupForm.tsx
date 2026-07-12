"use client";

import { useFormState, useFormStatus } from "react-dom";
import { runSetup, type SetupState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Configurando…" : "Crear plataforma"}
    </button>
  );
}

export default function SetupForm({ defaultYear }: { defaultYear: number }) {
  const [state, action] = useFormState<SetupState, FormData>(runSetup, {});

  return (
    <form action={action} className="card p-6 space-y-5">
      <section className="space-y-3">
        <h2 className="font-semibold text-stone-800">1 · Cuenta superadmin</h2>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />
        </div>
      </section>

      <section className="space-y-3 border-t border-stone-200 pt-4">
        <h2 className="font-semibold text-stone-800">2 · Local</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="label" htmlFor="localCode">Código</label>
            <input id="localCode" name="localCode" className="input" defaultValue="CDM" required />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="localName">Nombre</label>
            <input id="localName" name="localName" className="input" defaultValue="Corte de Manga" required />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-stone-200 pt-4">
        <h2 className="font-semibold text-stone-800">3 · Vacaciones {defaultYear}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="year">Año</label>
            <input id="year" name="year" type="number" className="input" defaultValue={defaultYear} required />
          </div>
          <div>
            <label className="label" htmlFor="daysPerEmployee">Días/persona</label>
            <input id="daysPerEmployee" name="daysPerEmployee" type="number" className="input" defaultValue={30} required />
          </div>
          <div>
            <label className="label" htmlFor="weeksPerEmployee">Semanas/persona</label>
            <input id="weeksPerEmployee" name="weeksPerEmployee" type="number" className="input" defaultValue={5} required />
          </div>
        </div>
        <p className="text-xs text-stone-400">
          Podrás ajustar fechas bloqueadas (temporada alta) y validar la capacidad
          antes de abrir solicitudes.
        </p>
      </section>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">{state.error}</p>
      )}
      <Submit />
    </form>
  );
}

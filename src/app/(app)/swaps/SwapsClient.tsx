"use client";

import { useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { proposeSwap, respondSwap, decideSwap, cancelSwap } from "./actions";

function Sub() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Enviando…" : "Proponer cambio"}</button>;
}

export function ProposeForm({
  shifts,
  colleagues,
}: {
  shifts: { id: string; label: string }[];
  colleagues: { id: string; name: string }[];
}) {
  const [state, action] = useFormState(proposeSwap, {});
  if (shifts.length === 0) return <p className="text-sm text-stone-500">No tienes turnos futuros publicados para cambiar.</p>;
  if (colleagues.length === 0) return <p className="text-sm text-stone-500">No hay compañeros a quienes ofrecer el turno.</p>;
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">Proponer cambio de turno</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Turno a ceder</label>
          <select name="shiftId" className="input" required>
            {shifts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Compañero</label>
          <select name="targetEmployeeId" className="input" required>
            {colleagues.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <input name="note" className="input" placeholder="Nota (opcional)" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Propuesta enviada.</p>}
      <Sub />
    </form>
  );
}

export function CompanionButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button className="btn-secondary text-xs px-2 py-1" disabled={pending} onClick={() => start(() => respondSwap(id, false))}>Rechazar</button>
      <button className="btn-primary text-xs px-2 py-1" disabled={pending} onClick={() => start(() => respondSwap(id, true))}>Aceptar</button>
    </div>
  );
}

export function ManagerButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button className="btn-secondary text-xs px-2 py-1" disabled={pending} onClick={() => start(async () => { await decideSwap(id, false); })}>Rechazar</button>
      <button className="btn-primary text-xs px-2 py-1" disabled={pending} onClick={() => start(async () => { await decideSwap(id, true); })}>Aprobar</button>
    </div>
  );
}

export function CancelSwap({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(() => cancelSwap(id))}>Cancelar</button>;
}

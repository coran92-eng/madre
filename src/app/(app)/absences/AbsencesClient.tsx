"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestAbsence, decideAbsence, cancelAbsence } from "./actions";

const TYPES: [string, string][] = [
  ["BAJA_MEDICA", "Baja médica"],
  ["MATRIMONIO", "Matrimonio"],
  ["MUDANZA", "Mudanza"],
  ["FALLECIMIENTO", "Fallecimiento familiar"],
  ["NACIMIENTO", "Nacimiento"],
  ["DEBER_PUBLICO", "Deber público"],
  ["LACTANCIA", "Lactancia"],
  ["OTRO", "Otro"],
];

function Sub() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Enviando…" : "Solicitar"}</button>;
}

export function RequestForm() {
  const [state, action] = useFormState(requestAbsence, {});
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">Solicitar ausencia o permiso</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Tipo</label>
          <select name="type" className="input">
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Desde</label>
          <input name="startDate" type="date" className="input" required />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input name="endDate" type="date" className="input" required />
        </div>
      </div>
      <div>
        <label className="label">Motivo / observaciones</label>
        <input name="reason" className="input" />
      </div>
      <div>
        <label className="label">Justificante (PDF/imagen, opcional)</label>
        <input name="justificante" type="file" accept="application/pdf,image/png,image/jpeg" className="input" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Solicitud enviada. Pendiente de aprobación.</p>}
      <Sub />
    </form>
  );
}

export function DecisionButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  if (rejecting) {
    return (
      <div className="flex flex-col items-end gap-1">
        <input className="input text-sm" placeholder="Motivo" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-2">
          <button className="text-xs text-stone-500" onClick={() => setRejecting(false)}>Cancelar</button>
          <button className="btn-danger text-xs px-2 py-1" disabled={pending} onClick={() => start(async () => { const r = await decideAbsence(id, false, note); setError(r.error); })}>Confirmar rechazo</button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex gap-2 justify-end">
      <button className="btn-secondary text-xs px-2 py-1" disabled={pending} onClick={() => setRejecting(true)}>Rechazar</button>
      <button className="btn-primary text-xs px-2 py-1" disabled={pending} onClick={() => start(async () => { await decideAbsence(id, true, ""); })}>Aprobar</button>
    </div>
  );
}

export function CancelButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(() => cancelAbsence(id))}>Cancelar</button>;
}

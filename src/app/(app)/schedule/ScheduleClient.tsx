"use client";

import { useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addShift, deleteShift, publishWeek } from "./actions";

function AddBtn() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Añadiendo…" : "Añadir turno"}</button>;
}

export function AddShiftForm({
  employees,
  days,
}: {
  employees: { id: string; name: string }[];
  days: { iso: string; label: string }[];
}) {
  const [state, action] = useFormState(addShift, {});
  return (
    <form action={action} className="card p-4 grid sm:grid-cols-5 gap-3 items-end">
      <div className="sm:col-span-2">
        <label className="label">Empleado</label>
        <select name="employeeId" className="input" required>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Día</label>
        <select name="date" className="input" required>
          {days.map((d) => <option key={d.iso} value={d.iso}>{d.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <div>
          <label className="label">Inicio</label>
          <input name="startTime" type="time" className="input" defaultValue="09:00" required />
        </div>
        <div>
          <label className="label">Fin</label>
          <input name="endTime" type="time" className="input" defaultValue="17:00" required />
        </div>
      </div>
      <div className="sm:col-span-5 flex items-center gap-3">
        <input name="note" className="input flex-1" placeholder="Nota (opcional)" />
        <AddBtn />
      </div>
      {state.error && <p className="sm:col-span-5 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function DeleteShift({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="text-red-500 hover:text-red-700 text-xs" disabled={pending} onClick={() => start(() => deleteShift(id))} title="Eliminar">✕</button>
  );
}

export function PublishButton({ localId, fromISO, toISO, count }: { localId: string; fromISO: string; toISO: string; count: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-primary"
      disabled={pending || count === 0}
      onClick={() => start(() => publishWeek(localId, fromISO, toISO))}
    >
      {pending ? "Publicando…" : count > 0 ? `Publicar semana (${count} sin publicar)` : "Todo publicado"}
    </button>
  );
}

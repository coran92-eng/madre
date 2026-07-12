"use client";

import { useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addIncident, deleteIncident } from "./actions";

function Sub() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Registrar incidencia"}</button>;
}

export function IncidentForm({
  employees,
  fixedEmployeeId,
}: {
  employees?: { id: string; name: string }[];
  fixedEmployeeId?: string;
}) {
  const [state, action] = useFormState(addIncident, {});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">Registrar incidencia</h2>
      {fixedEmployeeId ? (
        <input type="hidden" name="employeeId" value={fixedEmployeeId} />
      ) : (
        <div>
          <label className="label">Empleado</label>
          <select name="employeeId" className="input" required>
            {employees?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Fecha</label>
          <input name="date" type="date" className="input" defaultValue={today} required />
        </div>
        <div>
          <label className="label">Categoría</label>
          <input name="category" className="input" placeholder="Rendimiento / disciplina" />
        </div>
      </div>
      <div>
        <label className="label">Descripción</label>
        <textarea name="description" className="input min-h-[80px]" required />
      </div>
      <div>
        <label className="label">Adjunto (opcional)</label>
        <input name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="input" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Incidencia registrada.</p>}
      <Sub />
    </form>
  );
}

export function DeleteIncident({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(() => deleteIncident(id))}>Eliminar</button>;
}

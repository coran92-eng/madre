"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createTipPool, deleteTipPool } from "./actions";

function Sub() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Repartiendo…" : "Repartir bote"}</button>;
}

export function TipPoolForm({ localId, employees }: { localId: string; employees: { id: string; name: string }[] }) {
  const [state, action] = useFormState(createTipPool, {});
  const [method, setMethod] = useState("EQUAL");
  const [selected, setSelected] = useState<Set<string>>(new Set(employees.map((e) => e.id)));
  const today = new Date().toISOString().slice(0, 10);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">Repartir propinas</h2>
      <input type="hidden" name="localId" value={localId} />
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label className="label">Fecha</label>
          <input name="businessDate" type="date" className="input" defaultValue={today} required />
        </div>
        <div>
          <label className="label">Turno</label>
          <select name="shift" className="input"><option value="">—</option><option>Mañana</option><option>Tarde</option><option>Noche</option></select>
        </div>
        <div>
          <label className="label">Método</label>
          <select name="method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="EQUAL">Partes iguales</option>
            <option value="BY_HOURS">Por horas fichadas</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
        {method !== "MANUAL" && (
          <div>
            <label className="label">Total (€)</label>
            <input name="totalAmount" type="number" step="0.01" className="input" required />
          </div>
        )}
      </div>

      <div>
        <label className="label">Participantes</label>
        <div className="grid sm:grid-cols-2 gap-1">
          {employees.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-sm py-1">
              <input type="checkbox" name="participants" value={e.id} checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
              <span className="flex-1">{e.name}</span>
              {method === "MANUAL" && selected.has(e.id) && (
                <input name={`amount_${e.id}`} type="number" step="0.01" className="input py-1 text-sm w-24" placeholder="€" />
              )}
            </label>
          ))}
        </div>
      </div>

      <input name="note" className="input" placeholder="Nota (opcional)" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Bote repartido.</p>}
      <Sub />
    </form>
  );
}

export function DeletePool({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(() => deleteTipPool(id))}>Eliminar</button>;
}

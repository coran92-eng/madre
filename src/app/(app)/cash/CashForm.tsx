"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createCashClose } from "./actions";

function Sub() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Registrar cierre"}</button>;
}

export default function CashForm({ locals, fixedLocalId }: { locals: { id: string; name: string }[]; fixedLocalId?: string }) {
  const [state, action] = useFormState(createCashClose, {});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">Nuevo cierre de caja</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {fixedLocalId ? (
          <input type="hidden" name="localId" value={fixedLocalId} />
        ) : (
          <div>
            <label className="label">Local</label>
            <select name="localId" className="input" required>
              {locals.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Fecha</label>
          <input name="businessDate" type="date" className="input" defaultValue={today} required />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><label className="label">Fondo (€)</label><input name="openingFloat" type="number" step="0.01" className="input" defaultValue="0" /></div>
        <div><label className="label">Efectivo contado (€)</label><input name="cashCounted" type="number" step="0.01" className="input" required /></div>
        <div><label className="label">Esperado (€)</label><input name="expectedCash" type="number" step="0.01" className="input" /></div>
        <div><label className="label">Tarjeta (€)</label><input name="cardTotal" type="number" step="0.01" className="input" defaultValue="0" /></div>
        <div><label className="label">Otros (€)</label><input name="otherTotal" type="number" step="0.01" className="input" defaultValue="0" /></div>
      </div>
      <div>
        <label className="label">Notas</label>
        <input name="notes" className="input" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Cierre registrado.</p>}
      <Sub />
    </form>
  );
}

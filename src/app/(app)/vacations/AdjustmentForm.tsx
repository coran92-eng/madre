"use client";

import { useFormState, useFormStatus } from "react-dom";
import { requestAdjustment } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn-secondary" disabled={pending}>{pending ? "Enviando…" : "Solicitar ajuste"}</button>;
}

export default function AdjustmentForm({ year }: { year: number }) {
  const [state, action] = useFormState(requestAdjustment, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="year" value={year} />
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="days">Días (+)</label>
          <input id="days" name="days" type="number" step="0.5" className="input" placeholder="p.ej. 1" required />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="reason">Motivo</label>
          <input id="reason" name="reason" className="input" placeholder="Festivo trabajado 6 ene" required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="desiredDate">Fecha deseada de disfrute (opcional)</label>
        <input id="desiredDate" name="desiredDate" type="date" className="input" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Ajuste solicitado. Requiere aprobación.</p>}
      <Submit />
    </form>
  );
}

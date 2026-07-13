"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { correctEntry } from "./actions";

function Btn() {
  const { pending } = useFormStatus();
  return <button className="btn-danger text-xs px-2 py-1" disabled={pending}>{pending ? "…" : "Guardar corrección"}</button>;
}

export default function CorrectForm({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(correctEntry, {});

  if (!open) {
    return <button className="text-xs text-stone-500 hover:underline" onClick={() => setOpen(true)}>Corregir</button>;
  }
  return (
    <form action={action} className="mt-2 p-2 bg-stone-50 rounded border border-stone-200 space-y-2 text-xs">
      <input type="hidden" name="entryId" value={entryId} />
      <div className="flex gap-2">
        <select name="field" className="input text-xs py-1">
          <option value="clockIn">Entrada</option>
          <option value="clockOut">Salida</option>
        </select>
        <input name="newValue" type="datetime-local" className="input text-xs py-1" required />
      </div>
      <input name="reason" className="input text-xs py-1" placeholder="Motivo (obligatorio)" required />
      {state.error && <p className="text-red-600">{state.error}</p>}
      {state.ok && <p className="text-green-700">Corrección registrada.</p>}
      <div className="flex gap-2">
        <button type="button" className="text-stone-500" onClick={() => setOpen(false)}>Cerrar</button>
        <Btn />
      </div>
    </form>
  );
}

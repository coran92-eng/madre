"use client";

import { useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { postLog, markLogRead, deleteLog } from "./actions";

function PostBtn() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Publicando…" : "Publicar parte"}</button>;
}

export function PostForm() {
  const [state, action] = useFormState(postLog, {});
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">Dejar parte para el siguiente turno</h2>
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label className="label">Turno</label>
          <select name="shift" className="input">
            <option value="">—</option>
            <option>Mañana</option>
            <option>Tarde</option>
            <option>Noche</option>
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="label">Parte</label>
          <textarea name="body" className="input min-h-[70px]" placeholder="Se acabó el hielo, mesa 4 dejó a deber 20€, cafetera hace ruido…" required />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Parte publicado.</p>}
      <PostBtn />
    </form>
  );
}

export function ReadButton({ logId, done }: { logId: string; done: boolean }) {
  const [pending, start] = useTransition();
  if (done) return <span className="text-green-700 text-xs">✓ Leído</span>;
  return <button className="btn-secondary text-xs px-2 py-1" disabled={pending} onClick={() => start(() => markLogRead(logId))}>Marcar leído</button>;
}

export function DeleteLog({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(() => deleteLog(id))}>Eliminar</button>;
}

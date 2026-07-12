"use client";

import { useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createAnnouncement, deleteAnnouncement, markAnnouncementRead } from "./actions";

function Sub() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Publicando…" : "Publicar"}</button>;
}

export function AnnouncementForm({ locals, isSuper }: { locals: { id: string; name: string }[]; isSuper: boolean }) {
  const [state, action] = useFormState(createAnnouncement, {});
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">Nuevo comunicado</h2>
      {isSuper && (
        <div>
          <label className="label">Destino</label>
          <select name="localId" className="input">
            <option value="ALL">Todos los locales</option>
            {locals.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label">Título</label>
        <input name="title" className="input" required />
      </div>
      <div>
        <label className="label">Mensaje</label>
        <textarea name="body" className="input min-h-[100px]" required />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="requiresRead" type="checkbox" />
        Requiere confirmación de lectura
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Comunicado publicado.</p>}
      <Sub />
    </form>
  );
}

export function MarkReadButton({ id, done }: { id: string; done: boolean }) {
  const [pending, start] = useTransition();
  if (done) return <span className="text-green-700 text-xs">✓ Leído</span>;
  return (
    <button className="btn-primary text-xs px-3 py-1.5" disabled={pending} onClick={() => start(() => markAnnouncementRead(id))}>
      {pending ? "…" : "Confirmar lectura"}
    </button>
  );
}

export function DeleteAnnouncement({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(() => deleteAnnouncement(id))}>Eliminar</button>;
}

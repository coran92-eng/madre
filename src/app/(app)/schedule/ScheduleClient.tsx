"use client";

import { useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { addShift, deleteShift, publishWeek, saveTemplate, applyTemplate, deleteTemplate } from "./actions";

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

export function TemplatesPanel({
  localId,
  weekISO,
  templates,
}: {
  localId: string;
  weekISO: string;
  templates: { id: string; name: string; count: number }[];
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: boolean }>();

  return (
    <div className="card p-4">
      <h2 className="font-semibold mb-3">Plantillas de semana tipo</h2>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="flex-1 min-w-[10rem]">
          <label className="label">Guardar esta semana como plantilla</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Semana estándar" />
        </div>
        <button
          className="btn-secondary"
          disabled={pending || name.trim().length < 2}
          onClick={() => start(async () => { const r = await saveTemplate(localId, name, weekISO); setMsg(r); if (r.ok) setName(""); })}
        >
          Guardar
        </button>
      </div>
      {msg?.error && <p className="text-sm text-red-600 mb-2">{msg.error}</p>}
      {msg?.ok && <p className="text-sm text-green-700 mb-2">Hecho.</p>}
      {templates.length === 0 ? (
        <p className="text-sm text-stone-500">No hay plantillas guardadas.</p>
      ) : (
        <ul className="divide-y divide-stone-100 text-sm">
          {templates.map((t) => (
            <li key={t.id} className="py-2 flex items-center justify-between">
              <span>{t.name} <span className="text-xs text-stone-400">({t.count} turnos)</span></span>
              <div className="flex gap-2">
                <button className="btn-primary text-xs px-2 py-1" disabled={pending} onClick={() => start(async () => { setMsg(await applyTemplate(t.id, weekISO)); })}>Aplicar a esta semana</button>
                <button className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(() => deleteTemplate(t.id))}>Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

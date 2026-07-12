"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createLocal, updateLocal, setLocalActive } from "./actions";

function Sub({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : label}</button>;
}

export function CreateLocalForm() {
  const [state, action] = useFormState(createLocal, {});
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">Nuevo local</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        <div><label className="label">Código</label><input name="code" className="input" placeholder="SBCN" required /></div>
        <div className="sm:col-span-2"><label className="label">Nombre</label><input name="name" className="input" placeholder="La Sastrería Barcelona" required /></div>
      </div>
      <div className="max-w-[12rem]">
        <label className="label">Aviso caducidades (días)</label>
        <input name="alertLeadDays" type="number" className="input" defaultValue={30} />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Local creado.</p>}
      <Sub label="Crear local" />
    </form>
  );
}

export function EditLocalRow({ local }: { local: { id: string; code: string; name: string; alertLeadDays: number; active: boolean } }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [state, action] = useFormState(updateLocal.bind(null, local.id), {});

  return (
    <div className="p-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{local.name}</span>
          <span className="text-xs text-stone-400 ml-2">{local.code} · aviso {local.alertLeadDays}d</span>
          {!local.active && <span className="badge bg-stone-200 text-stone-600 ml-2">inactivo</span>}
        </div>
        <div className="flex gap-2">
          <button className="text-madre hover:underline text-sm" onClick={() => setOpen(!open)}>{open ? "Cerrar" : "Editar"}</button>
          <button className={`text-xs px-2 py-1 ${local.active ? "btn-danger" : "btn-primary"}`} disabled={pending} onClick={() => start(() => setLocalActive(local.id, !local.active))}>
            {local.active ? "Desactivar" : "Reactivar"}
          </button>
        </div>
      </div>
      {open && (
        <form action={action} className="mt-3 grid sm:grid-cols-4 gap-2 items-end">
          <div className="sm:col-span-2"><label className="label">Nombre</label><input name="name" className="input" defaultValue={local.name} required /></div>
          <input type="hidden" name="code" value={local.code} />
          <div><label className="label">Aviso (días)</label><input name="alertLeadDays" type="number" className="input" defaultValue={local.alertLeadDays} /></div>
          <Sub label="Guardar" />
          {state.ok && <p className="text-xs text-green-700 sm:col-span-4">Guardado.</p>}
          {state.error && <p className="text-xs text-red-600 sm:col-span-4">{state.error}</p>}
        </form>
      )}
    </div>
  );
}

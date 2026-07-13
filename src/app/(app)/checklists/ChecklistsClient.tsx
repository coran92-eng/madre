"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveTemplate, toggleTemplate, addItem, removeItem, checkItem } from "./actions";

export function CheckRow({ itemId, label, checked, byName, at }: { itemId: string; label: string; checked: boolean; byName?: string | null; at?: string | null }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-3 py-2 cursor-pointer">
      <input
        type="checkbox"
        className="w-5 h-5 accent-[#7c1d1d]"
        defaultChecked={checked}
        disabled={pending}
        onChange={(e) => start(() => checkItem(itemId, e.target.checked))}
      />
      <span className={checked ? "text-stone-500 line-through" : ""}>{label}</span>
      {checked && byName && <span className="text-xs text-stone-400 ml-auto">{byName} · {at}</span>}
    </label>
  );
}

function SaveBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : label}</button>;
}

export function TemplateForm({ localId, template }: { localId: string; template?: { id: string; name: string; moment: string; order: number } }) {
  const [state, action] = useFormState(saveTemplate, {});
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">{template ? "Editar checklist" : "Nueva checklist"}</h2>
      <input type="hidden" name="localId" value={localId} />
      {template && <input type="hidden" name="id" value={template.id} />}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="label">Momento</label>
          <select name="moment" className="input" defaultValue={template?.moment ?? "APERTURA"}>
            <option value="APERTURA">Apertura</option>
            <option value="CIERRE">Cierre</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Nombre</label>
          <input name="name" className="input" defaultValue={template?.name} placeholder="Apertura de barra" required />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Guardado.</p>}
      <SaveBtn label={template ? "Guardar" : "Crear checklist"} />
    </form>
  );
}

export function ToggleTemplate({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className={`text-xs px-2 py-1 ${active ? "btn-danger" : "btn-primary"}`} disabled={pending} onClick={() => start(() => toggleTemplate(id, !active))}>
      {active ? "Desactivar" : "Activar"}
    </button>
  );
}

export function AddItem({ templateId }: { templateId: string }) {
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string>();
  return (
    <div className="flex gap-2 mt-2">
      <input className="input py-1 text-sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nueva tarea…" />
      <button className="btn-secondary text-xs" disabled={pending || label.trim().length < 2} onClick={() => start(async () => { const r = await addItem(templateId, label); if (r.error) setError(r.error); else { setLabel(""); setError(undefined); } })}>
        Añadir
      </button>
      {error && <span className="text-xs text-red-600 self-center">{error}</span>}
    </div>
  );
}

export function RemoveItem({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="text-red-500 hover:text-red-700 text-xs" disabled={pending} onClick={() => start(() => removeItem(id))}>✕</button>;
}

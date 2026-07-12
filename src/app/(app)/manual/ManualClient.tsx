"use client";

import { useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { confirmRead, createSection, updateSection, deleteSection } from "./actions";

export function ConfirmReadButton({ sectionId, done }: { sectionId: string; done: boolean }) {
  const [pending, start] = useTransition();
  if (done) return <span className="text-green-700 text-xs">✓ Leído</span>;
  return (
    <button className="btn-primary text-xs px-3 py-1.5" disabled={pending} onClick={() => start(() => confirmRead(sectionId))}>
      {pending ? "…" : "Confirmar lectura"}
    </button>
  );
}

function Sub({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : label}</button>;
}

type Section = { id: string; title: string; content: string; order: number; requiresReadConfirm: boolean };

export function SectionForm({ localId, section }: { localId: string; section?: Section }) {
  const action = section ? updateSection.bind(null, section.id) : createSection;
  const [state, formAction] = useFormState(action, {});
  return (
    <form action={formAction} className="card p-4 space-y-3">
      <input type="hidden" name="localId" value={localId} />
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="sm:col-span-3">
          <label className="label">Título</label>
          <input name="title" className="input" defaultValue={section?.title} required />
        </div>
        <div>
          <label className="label">Orden</label>
          <input name="order" type="number" className="input" defaultValue={section?.order ?? 0} />
        </div>
      </div>
      <div>
        <label className="label">Contenido</label>
        <textarea name="content" className="input min-h-[160px] font-mono text-sm" defaultValue={section?.content} required />
        <p className="text-xs text-stone-400 mt-1">
          Admite Markdown: <code># título</code>, <code>**negrita**</code>, listas con <code>-</code>,
          enlaces <code>[texto](url)</code> e imágenes <code>![alt](url)</code>. Al cambiar el
          contenido se sube la versión y se pedirá relectura.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="requiresReadConfirm" type="checkbox" defaultChecked={section?.requiresReadConfirm ?? true} />
        Requiere confirmación de lectura
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Guardado.</p>}
      <Sub label={section ? "Guardar cambios" : "Crear sección"} />
    </form>
  );
}

export function DeleteSection({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="btn-danger text-xs px-2 py-1" disabled={pending} onClick={() => start(() => deleteSection(id))}>Eliminar</button>;
}

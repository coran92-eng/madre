"use client";

import { useTransition, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { confirmRead, createSection, updateSection, deleteSection, uploadManualImage } from "./actions";

function ImageUploader({ localId, onInsert }: { localId: string; onInsert: (url: string) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex items-center gap-2 text-xs">
      <label className="btn-secondary text-xs px-2 py-1 cursor-pointer">
        Subir imagen
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.set("localId", localId);
            fd.set("file", file);
            start(async () => {
              const r = await uploadManualImage(fd);
              if (r.error) setError(r.error);
              else if (r.url) { onInsert(r.url); setError(undefined); }
            });
            e.target.value = "";
          }}
        />
      </label>
      {pending && <span className="text-stone-400">subiendo…</span>}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}

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
  const contentRef = useRef<HTMLTextAreaElement>(null);

  function insertImage(url: string) {
    const ta = contentRef.current;
    if (!ta) return;
    const snippet = `\n![imagen](${url})\n`;
    const pos = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, pos) + snippet + ta.value.slice(pos);
    ta.focus();
  }

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
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">Contenido</label>
          <ImageUploader localId={localId} onInsert={insertImage} />
        </div>
        <textarea ref={contentRef} name="content" className="input min-h-[160px] font-mono text-sm" defaultValue={section?.content} required />
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

"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { savePoint, togglePoint, recordAppcc } from "./actions";

const CATEGORIES: [string, string][] = [
  ["TEMPERATURA", "Temperatura"],
  ["RECEPCION", "Recepción de mercancía"],
  ["LIMPIEZA", "Limpieza y desinfección"],
  ["ACEITE", "Aceite de freidora"],
  ["TRAZABILIDAD", "Trazabilidad"],
  ["OTRO", "Otro"],
];

function RecBtn() {
  const { pending } = useFormStatus();
  return <button className="btn-primary text-xs px-3 py-1.5" disabled={pending}>{pending ? "…" : "Registrar"}</button>;
}

export function RecordForm({
  point,
}: {
  point: { id: string; kind: string; unit: string | null };
}) {
  const [state, action] = useFormState(recordAppcc, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="pointId" value={point.id} />
      {point.kind === "NUMERIC" && (
        <div className="flex items-center gap-1">
          <input name="value" type="number" step="0.1" className="input w-24 py-1 text-sm" required />
          {point.unit && <span className="text-xs text-stone-400">{point.unit}</span>}
        </div>
      )}
      {point.kind === "BOOLEAN" && (
        <label className="flex items-center gap-1 text-sm">
          <input name="value" type="checkbox" defaultChecked /> Hecho
        </label>
      )}
      {point.kind === "TEXT" && <input name="value" className="input py-1 text-sm" placeholder="Proveedor / lote…" required />}
      <input name="note" className="input py-1 text-sm w-28" placeholder="Nota" />
      <RecBtn />
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.ok && <span className="text-xs text-green-700">✓</span>}
    </form>
  );
}

function SaveBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : label}</button>;
}

type Point = {
  id: string; name: string; category: string; kind: string; unit: string | null;
  minValue: number | null; maxValue: number | null; frequency: string; order: number;
};

export function PointForm({ localId, point }: { localId: string; point?: Point }) {
  const [state, action] = useFormState(savePoint, {});
  const [kind, setKind] = useState(point?.kind ?? "NUMERIC");
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">{point ? "Editar punto de control" : "Nuevo punto de control"}</h2>
      <input type="hidden" name="localId" value={localId} />
      {point && <input type="hidden" name="id" value={point.id} />}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Nombre</label>
          <input name="name" className="input" defaultValue={point?.name} placeholder="Nevera 1" required />
        </div>
        <div>
          <label className="label">Categoría</label>
          <select name="category" className="input" defaultValue={point?.category ?? "TEMPERATURA"}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipo de dato</label>
          <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="NUMERIC">Numérico (con umbral)</option>
            <option value="BOOLEAN">Sí / No (hecho)</option>
            <option value="TEXT">Texto (proveedor/lote)</option>
          </select>
        </div>
        <div>
          <label className="label">Frecuencia</label>
          <select name="frequency" className="input" defaultValue={point?.frequency ?? "DIARIO"}>
            <option value="POR_TURNO">Por turno</option>
            <option value="DIARIO">Diario</option>
            <option value="SEMANAL">Semanal</option>
          </select>
        </div>
        {kind === "NUMERIC" && (
          <>
            <div><label className="label">Unidad</label><input name="unit" className="input" defaultValue={point?.unit ?? ""} placeholder="°C" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Mín.</label><input name="minValue" type="number" step="0.1" className="input" defaultValue={point?.minValue ?? ""} /></div>
              <div><label className="label">Máx.</label><input name="maxValue" type="number" step="0.1" className="input" defaultValue={point?.maxValue ?? ""} /></div>
            </div>
          </>
        )}
        <div><label className="label">Orden</label><input name="order" type="number" className="input" defaultValue={point?.order ?? 0} /></div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Guardado.</p>}
      <SaveBtn label={point ? "Guardar" : "Crear punto"} />
    </form>
  );
}

export function TogglePoint({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className={`text-xs px-2 py-1 ${active ? "btn-danger" : "btn-primary"}`} disabled={pending} onClick={() => start(() => togglePoint(id, !active))}>
      {active ? "Desactivar" : "Activar"}
    </button>
  );
}

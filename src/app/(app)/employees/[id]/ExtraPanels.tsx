"use client";

import { useState, useTransition } from "react";
import { setClockPin, addExpiry, resolveExpiry } from "../actions";

const EXPIRY_TYPES: [string, string][] = [
  ["CARNET_MANIPULADOR", "Carnet manipulador"],
  ["FORMACION_ALERGENOS", "Formación alérgenos"],
  ["NIE", "NIE"],
  ["DNI", "DNI"],
  ["CONTRATO_TEMPORAL", "Contrato temporal"],
  ["PERIODO_PRUEBA", "Período de prueba"],
  ["OTRO", "Otro"],
];

export function PinPanel({ employeeId, hasPin }: { employeeId: string; hasPin: boolean }) {
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: boolean }>();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label">PIN de fichaje (4-6 dígitos)</label>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" className="input w-40" placeholder={hasPin ? "•••• (definido)" : "sin PIN"} />
      </div>
      <button className="btn-secondary" disabled={pending || pin.length < 4} onClick={() => start(async () => { const r = await setClockPin(employeeId, pin); setMsg(r); if (r.ok) setPin(""); })}>
        {pending ? "…" : hasPin ? "Cambiar PIN" : "Definir PIN"}
      </button>
      {msg?.error && <span className="text-sm text-red-600">{msg.error}</span>}
      {msg?.ok && <span className="text-sm text-green-700">PIN guardado.</span>}
    </div>
  );
}

export function ExpiryPanel({
  employeeId,
  expiries,
}: {
  employeeId: string;
  expiries: { id: string; type: string; label: string | null; dueDate: string; resolved: boolean }[];
}) {
  const [type, setType] = useState("CARNET_MANIPULADOR");
  const [due, setDue] = useState("");
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            {EXPIRY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Caduca</label>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input" />
        </div>
        <div className="flex-1 min-w-[8rem]">
          <label className="label">Nota</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" />
        </div>
        <button className="btn-secondary" disabled={pending || !due} onClick={() => start(async () => { const r = await addExpiry(employeeId, type, due, label); setError(r.error); if (r.ok) { setDue(""); setLabel(""); } })}>
          Añadir
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {expiries.length > 0 && (
        <ul className="divide-y divide-stone-100 text-sm">
          {expiries.map((x) => (
            <li key={x.id} className="py-1.5 flex items-center justify-between">
              <span className={x.resolved ? "text-stone-400 line-through" : ""}>
                {EXPIRY_TYPES.find(([v]) => v === x.type)?.[1] ?? x.type}{x.label ? ` · ${x.label}` : ""} — {x.dueDate}
              </span>
              {!x.resolved && <ResolveBtn id={x.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResolveBtn({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="text-xs text-stone-500 hover:underline" disabled={pending} onClick={() => start(() => resolveExpiry(id))}>Resuelto</button>;
}

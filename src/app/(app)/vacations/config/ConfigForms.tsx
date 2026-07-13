"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveVacationYear, toggleRequests, addBlockedWeek, removeBlockedWeek } from "../actions";

function SaveBtn() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Guardar configuración"}</button>;
}

export function YearForm({
  localId,
  year,
  cfg,
}: {
  localId: string;
  year: number;
  cfg: { daysPerEmployee: number; weeksPerEmployee: number; accrualPerMonth: number; priorityRule: string } | null;
}) {
  const [state, action] = useFormState(saveVacationYear, {});
  return (
    <form action={action} className="grid sm:grid-cols-2 gap-3">
      <input type="hidden" name="localId" value={localId} />
      <input type="hidden" name="year" value={year} />
      <div>
        <label className="label">Días naturales / persona</label>
        <input name="daysPerEmployee" type="number" className="input" defaultValue={cfg?.daysPerEmployee ?? 30} />
      </div>
      <div>
        <label className="label">Semanas / persona</label>
        <input name="weeksPerEmployee" type="number" className="input" defaultValue={cfg?.weeksPerEmployee ?? 5} />
      </div>
      <div>
        <label className="label">Devengo (días/mes)</label>
        <input name="accrualPerMonth" type="number" step="0.1" className="input" defaultValue={cfg?.accrualPerMonth ?? 2.5} />
      </div>
      <div>
        <label className="label">Prioridad en conflictos</label>
        <select name="priorityRule" className="input" defaultValue={cfg?.priorityRule ?? "ORDEN_SOLICITUD"}>
          <option value="ORDEN_SOLICITUD">Orden de solicitud</option>
          <option value="ANTIGUEDAD">Antigüedad</option>
          <option value="ROTACION">Rotación anual</option>
        </select>
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <SaveBtn />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-green-700">Guardado.</span>}
      </div>
    </form>
  );
}

export function RequestsToggle({ localId, year, open }: { localId: string; year: number; open: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      className={open ? "btn-danger" : "btn-primary"}
      disabled={pending}
      onClick={() => start(() => toggleRequests(localId, year, !open))}
    >
      {pending ? "…" : open ? "Cerrar solicitudes" : "Abrir solicitudes"}
    </button>
  );
}

export function BlockedWeeks({
  localId,
  year,
  weeks,
}: {
  localId: string;
  year: number;
  weeks: { id: string; week: number; reason: string | null; label: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  function add(fd: FormData) {
    const week = Number(fd.get("week"));
    const reason = String(fd.get("reason") ?? "");
    start(async () => {
      const res = await addBlockedWeek(localId, year, week, reason);
      setError(res.error);
    });
  }

  return (
    <div>
      <form action={add} className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="label">Semana ISO</label>
          <input name="week" type="number" min={1} max={53} className="input w-28" required />
        </div>
        <div className="flex-1 min-w-[10rem]">
          <label className="label">Motivo</label>
          <input name="reason" className="input" placeholder="Temporada alta verano" />
        </div>
        <button className="btn-secondary" disabled={pending}>Bloquear</button>
      </form>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {weeks.length === 0 ? (
        <p className="text-sm text-stone-500">Ninguna semana bloqueada.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {weeks.map((w) => (
            <li key={w.id} className="badge bg-amber-100 text-amber-800 gap-2">
              Sem. {w.week} · {w.label}
              {w.reason ? ` (${w.reason})` : ""}
              <button
                className="ml-1 text-amber-900 hover:text-red-700"
                onClick={() => start(() => removeBlockedWeek(w.id))}
                title="Quitar"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

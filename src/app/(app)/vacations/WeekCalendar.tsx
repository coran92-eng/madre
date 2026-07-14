"use client";

import { useState, useTransition } from "react";
import type { WeekStatus } from "@/lib/vacations";
import { requestVacation } from "./actions";

export default function WeekCalendar({
  weeks,
  year,
  selectable,
  balanceDays,
}: {
  weeks: WeekStatus[];
  year: number;
  selectable: boolean;
  /** Saldo de días disponible antes de esta selección (spec §4.2: 1 semana = 7 días). */
  balanceDays?: number;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: boolean }>();

  function toggle(week: number) {
    if (!selectable) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(week) ? next.delete(week) : next.add(week);
      return next;
    });
  }

  function submit() {
    start(async () => {
      const res = await requestVacation(year, Array.from(selected));
      setMsg(res);
      if (res.ok) setSelected(new Set());
    });
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {weeks.map((w) => {
          const isSel = selected.has(w.week);
          const base = "rounded-md border p-2 text-left text-xs transition select-none";
          let cls = "border-stone-200 bg-white";
          let disabled = true;
          let sub: React.ReactNode = null;

          if (w.state === "available") {
            disabled = !selectable;
            cls = isSel
              ? "border-madre bg-madre text-white"
              : "border-green-200 bg-green-50 hover:border-green-400 cursor-pointer";
            sub = <span className={isSel ? "text-white/80" : "text-green-700"}>Disponible</span>;
          } else if (w.state === "mine") {
            cls = "border-madre-600 bg-madre-50 text-madre-900";
            sub = <span className="font-medium">Tú · {w.requestStatus}</span>;
          } else if (w.state === "occupied") {
            cls = "border-stone-200 bg-stone-100 text-stone-400";
            sub = <span>Ocupada · {w.by}</span>;
          } else if (w.state === "blocked") {
            cls = "border-amber-200 bg-amber-50 text-amber-700";
            sub = <span>Bloqueada{w.reason ? ` · ${w.reason}` : ""}</span>;
          }

          return (
            <button
              type="button"
              key={w.week}
              disabled={disabled}
              onClick={() => w.state === "available" && toggle(w.week)}
              className={`${base} ${cls} ${disabled ? "cursor-default" : ""}`}
            >
              <div className="font-semibold">Sem. {w.week}</div>
              <div className="opacity-90">{w.label}</div>
              <div className="mt-1 truncate">{sub}</div>
            </button>
          );
        })}
      </div>

      {selectable && (
        <div className="mt-4 space-y-2">
          {balanceDays != null && (
            <p className="text-sm text-stone-600">
              Saldo disponible: <strong>{balanceDays} d</strong>
              {selected.size > 0 && (
                <>
                  {" · "}seleccionadas {selected.size} semana{selected.size === 1 ? "" : "s"} ({selected.size * 7} d)
                  {" · "}quedarían{" "}
                  <strong className={balanceDays - selected.size * 7 < 0 ? "text-red-600" : ""}>
                    {balanceDays - selected.size * 7} d
                  </strong>
                </>
              )}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={pending || selected.size === 0} onClick={submit}>
              {pending ? "Enviando…" : `Solicitar ${selected.size} semana${selected.size === 1 ? "" : "s"}`}
            </button>
            {msg?.error && <span className="text-sm text-red-600">{msg.error}</span>}
            {msg?.ok && <span className="text-sm text-green-700">Solicitud enviada. Pendiente de aprobación.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { WeekCell } from "@/lib/vacations";
import { requestVacation } from "./actions";

const DOW = ["L", "M", "X", "J", "V", "S", "D"];

export default function WeekCalendar({
  weeks,
  year,
  selectable,
  balanceDays,
  pendingDays,
}: {
  weeks: WeekCell[];
  year: number;
  selectable: boolean;
  /** Saldo de días disponible antes de esta selección. */
  balanceDays?: number;
  /** Días ya pedidos en otras solicitudes pendientes de aprobar. */
  pendingDays?: number;
}) {
  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(new Set());
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: boolean }>();

  function toggleWeek(week: WeekCell) {
    if (!selectable) return;
    const wholeWeekAvailable = week.days.every((d) => d.state === "available");
    if (!wholeWeekAvailable) return;
    setSelectedWeeks((prev) => {
      const next = new Set(prev);
      next.has(week.week) ? next.delete(week.week) : next.add(week.week);
      return next;
    });
  }

  function toggleDay(date: string, state: string) {
    if (!selectable || state !== "available") return;
    setSelectedDays((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }

  function submit() {
    start(async () => {
      const res = await requestVacation(year, Array.from(selectedWeeks), Array.from(selectedDays));
      setMsg(res);
      if (res.ok) {
        setSelectedWeeks(new Set());
        setSelectedDays(new Set());
      }
    });
  }

  const totalSelected = selectedWeeks.size * 7 + selectedDays.size;
  // Igual que el servidor: saldo menos lo que ya está pendiente de aprobar
  // en otras solicitudes (spec: no dejar pedir más de lo que queda).
  const available = balanceDays != null ? balanceDays - (pendingDays ?? 0) : undefined;
  const exceedsBalance = available != null && totalSelected > available;

  return (
    <div>
      <div className="space-y-2">
        {weeks.map((w) => {
          const isWeekSelected = selectedWeeks.has(w.week);
          const wholeWeekAvailable = w.days.every((d) => d.state === "available");

          return (
            <div key={w.week} className="rounded-md border border-stone-200 p-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs text-stone-500">
                  <span className="font-semibold text-stone-700">Sem. {w.week}</span> · {w.label}
                </div>
                {selectable && wholeWeekAvailable && (
                  <button
                    type="button"
                    onClick={() => toggleWeek(w)}
                    className={`text-xs px-2 py-0.5 rounded border transition ${
                      isWeekSelected
                        ? "border-madre bg-madre text-white"
                        : "border-green-300 bg-green-50 text-green-700 hover:border-green-500"
                    }`}
                  >
                    {isWeekSelected ? "Semana completa ✓" : "Semana completa"}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {w.days.map((d, i) => {
                  const daySelected = isWeekSelected || selectedDays.has(d.date);
                  const clickableAsLoose = selectable && d.state === "available" && !isWeekSelected;
                  let cls = "border-stone-200 bg-white text-stone-400";
                  let title = "";

                  if (isWeekSelected) {
                    cls = "border-madre bg-madre text-white";
                    title = "Semana completa seleccionada";
                  } else if (d.state === "available") {
                    cls = selectedDays.has(d.date)
                      ? "border-madre bg-madre text-white"
                      : "border-green-200 bg-green-50 hover:border-green-400 cursor-pointer text-green-800";
                    title = "Disponible";
                  } else if (d.state === "mine") {
                    cls = "border-madre-600 bg-madre-50 text-madre-900";
                    title = `Tuyo · ${d.requestStatus}`;
                  } else if (d.state === "occupied") {
                    cls = "border-stone-200 bg-stone-100 text-stone-400";
                    title = `Ocupado · ${d.by}`;
                  } else if (d.state === "blocked") {
                    cls = "border-amber-200 bg-amber-50 text-amber-700";
                    title = `Bloqueado${d.reason ? ` · ${d.reason}` : ""}`;
                  }

                  return (
                    <button
                      type="button"
                      key={d.date}
                      title={title}
                      disabled={!clickableAsLoose}
                      onClick={() => toggleDay(d.date, d.state)}
                      className={`rounded border p-1.5 text-center text-xs transition select-none ${cls} ${
                        clickableAsLoose ? "cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <div className="opacity-70">{DOW[i]}</div>
                      <div className="font-semibold">{Number(d.date.slice(8, 10))}</div>
                    </button>
                  );
                })}
              </div>
              {!wholeWeekAvailable && selectable && (
                <p className="mt-1 text-[11px] text-stone-400">
                  Semana no disponible completa — puedes coger los días sueltos en verde.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {selectable && (
        <div className="mt-4 space-y-2">
          {balanceDays != null && (
            <p className="text-sm text-stone-600">
              Saldo disponible: <strong>{available} d</strong>
              {!!pendingDays && ` (${balanceDays} d de saldo − ${pendingDays} d ya pendientes de aprobar)`}
              {totalSelected > 0 && (
                <>
                  {" · "}seleccionado{totalSelected === 1 ? "" : "s"} {totalSelected} día{totalSelected === 1 ? "" : "s"}
                  {selectedWeeks.size > 0 && ` (${selectedWeeks.size} semana${selectedWeeks.size === 1 ? "" : "s"}${selectedDays.size > 0 ? ` + ${selectedDays.size} suelto${selectedDays.size === 1 ? "" : "s"}` : ""})`}
                  {" · "}quedarían{" "}
                  <strong className={exceedsBalance ? "text-red-600" : ""}>{(available ?? 0) - totalSelected} d</strong>
                </>
              )}
            </p>
          )}
          {exceedsBalance && (
            <p className="text-sm text-red-600">
              Has seleccionado más días de los que tienes disponibles. Quita alguno para poder enviar la solicitud.
            </p>
          )}
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={pending || totalSelected === 0 || exceedsBalance} onClick={submit}>
              {pending ? "Enviando…" : `Solicitar ${totalSelected} día${totalSelected === 1 ? "" : "s"}`}
            </button>
            {msg?.error && <span className="text-sm text-red-600">{msg.error}</span>}
            {msg?.ok && <span className="text-sm text-green-700">Solicitud enviada. Pendiente de aprobación.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

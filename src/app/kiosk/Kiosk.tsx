"use client";

import { useState, useTransition } from "react";
import { kioskClock } from "./actions";

type Emp = { id: string; name: string; hasOpen: boolean };

export default function Kiosk({ localName, employees }: { localName: string; employees: Emp[] }) {
  const [sel, setSel] = useState<Emp | null>(null);
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  function press(n: string) {
    if (pin.length < 6) setPin(pin + n);
  }
  function submit() {
    if (!sel || pin.length < 4) return;
    start(async () => {
      const res = await kioskClock(sel.id, pin);
      if (res.ok) {
        setFlash({ ok: true, text: `${res.name}: ${res.action === "in" ? "ENTRADA" : "SALIDA"} registrada a las ${res.at}` });
      } else {
        setFlash({ ok: false, text: res.error });
      }
      setPin("");
      setSel(null);
      setTimeout(() => setFlash(null), 4000);
    });
  }

  return (
    <div className="min-h-screen bg-madre-900 text-white flex flex-col">
      <header className="p-6 text-center border-b border-white/10">
        <div className="font-serif text-3xl font-bold">MADRE · Fichaje</div>
        <div className="text-stone-300 text-sm mt-1">{localName}</div>
      </header>

      {flash && (
        <div className={`m-4 rounded-lg p-4 text-center text-lg font-medium ${flash.ok ? "bg-green-600" : "bg-red-600"}`}>
          {flash.text}
        </div>
      )}

      <div className="flex-1 p-4 md:p-8">
        {!sel ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {employees.length === 0 && <p className="col-span-full text-center text-stone-300">No hay empleados activos.</p>}
            {employees.map((e) => (
              <button
                key={e.id}
                onClick={() => { setSel(e); setPin(""); }}
                className="rounded-xl bg-white/10 hover:bg-white/20 p-5 text-lg font-medium transition text-left"
              >
                {e.name}
                <div className={`text-xs mt-1 ${e.hasOpen ? "text-amber-300" : "text-stone-400"}`}>
                  {e.hasOpen ? "● fichaje abierto" : "○ fuera"}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="max-w-xs mx-auto text-center">
            <div className="text-xl font-medium mb-1">{sel.name}</div>
            <div className="text-stone-300 text-sm mb-4">{sel.hasOpen ? "Vas a registrar SALIDA" : "Vas a registrar ENTRADA"}</div>
            <div className="text-3xl tracking-widest h-10 mb-4">{pin.replace(/./g, "•")}</div>
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                <button key={n} onClick={() => press(n)} className="rounded-lg bg-white/10 hover:bg-white/20 py-4 text-2xl">{n}</button>
              ))}
              <button onClick={() => setPin(pin.slice(0, -1))} className="rounded-lg bg-white/5 hover:bg-white/15 py-4 text-lg">←</button>
              <button onClick={() => press("0")} className="rounded-lg bg-white/10 hover:bg-white/20 py-4 text-2xl">0</button>
              <button onClick={submit} disabled={pending || pin.length < 4} className="rounded-lg bg-green-600 hover:bg-green-700 py-4 text-lg disabled:opacity-40">✓</button>
            </div>
            <button onClick={() => { setSel(null); setPin(""); }} className="mt-4 text-stone-300 underline text-sm">Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}

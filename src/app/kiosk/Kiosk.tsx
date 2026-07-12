"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { kioskClock } from "./actions";

type Emp = { id: string; name: string; hasOpen: boolean };
type Queued = { employeeId: string; name: string; pin: string; action: "in" | "out"; at: string };

const QKEY = "madre_offline_punches";

function loadQueue(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(QKEY) || "[]");
  } catch {
    return [];
  }
}
function saveQueue(q: Queued[]) {
  localStorage.setItem(QKEY, JSON.stringify(q));
}

export default function Kiosk({ localName, employees }: { localName: string; employees: Emp[] }) {
  const [sel, setSel] = useState<Emp | null>(null);
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [queueLen, setQueueLen] = useState(0);

  // Replay queued punches (PIN re-verified server-side on replay).
  const flush = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    let q = loadQueue();
    if (q.length === 0) return;
    const remaining: Queued[] = [];
    for (const item of q.sort((a, b) => a.at.localeCompare(b.at))) {
      try {
        const res = await kioskClock(item.employeeId, item.pin, { atISO: item.at, action: item.action });
        if (!res.ok && res.error === "PIN no válido.") {
          // drop malformed
        } else if (!res.ok && /rango|abierto/.test(res.error)) {
          // unrecoverable (stale) — drop
        } else if (!res.ok) {
          remaining.push(item); // transient — keep
        }
      } catch {
        remaining.push(item);
      }
    }
    saveQueue(remaining);
    setQueueLen(remaining.length);
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    setQueueLen(loadQueue().length);
    const on = () => { setOnline(true); flush(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    flush();
    // Register the offline service worker (kiosk shell).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [flush]);

  function press(n: string) {
    if (pin.length < 6) setPin(pin + n);
  }

  function submit() {
    if (!sel || pin.length < 4) return;
    const chosen = sel;
    const enteredPin = pin;
    start(async () => {
      const wentOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (!wentOffline) {
        try {
          const res = await kioskClock(chosen.id, enteredPin);
          setFlash(res.ok
            ? { ok: true, text: `${res.name}: ${res.action === "in" ? "ENTRADA" : "SALIDA"} a las ${res.at}` }
            : { ok: false, text: res.error });
          setPin(""); setSel(null);
          setTimeout(() => setFlash(null), 4000);
          return;
        } catch {
          // network failed mid-request → fall through to offline queue
        }
      }
      // Offline: queue with captured timestamp + intended action.
      const q = loadQueue();
      q.push({ employeeId: chosen.id, name: chosen.name, pin: enteredPin, action: chosen.hasOpen ? "out" : "in", at: new Date().toISOString() });
      saveQueue(q);
      setQueueLen(q.length);
      setFlash({ ok: true, text: `${chosen.name}: ${chosen.hasOpen ? "SALIDA" : "ENTRADA"} guardada sin conexión (se sincronizará)` });
      setPin(""); setSel(null);
      setTimeout(() => setFlash(null), 4000);
    });
  }

  return (
    <div className="min-h-screen bg-madre-900 text-white flex flex-col">
      <header className="p-6 text-center border-b border-white/10 relative">
        <div className="font-serif text-3xl font-bold">MADRE · Fichaje</div>
        <div className="text-stone-300 text-sm mt-1">{localName}</div>
        <div className="absolute top-4 right-4 text-xs flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${online ? "bg-green-400" : "bg-amber-400"}`} />
          {online ? "en línea" : "sin conexión"}
          {queueLen > 0 && <span className="text-amber-300">· {queueLen} pendiente(s)</span>}
        </div>
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

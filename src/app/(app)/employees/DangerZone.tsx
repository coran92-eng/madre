"use client";

import { useState, useTransition } from "react";
import { purgeAllEmployees } from "./actions";

export default function DangerZone({ localId, localName, count }: { localId: string; localName: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; ok?: boolean; count?: number }>();

  function go() {
    start(async () => setResult(await purgeAllEmployees(localId, confirm)));
  }

  if (result?.ok && !result.error) {
    return (
      <div className="card p-4 border-red-200 bg-red-50 mt-8">
        <p className="text-sm text-red-800 font-medium">
          Borrados {result.count} empleado(s) de {localName} y todos sus datos.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4 border-red-200 mt-8">
      <button
        type="button"
        className="text-sm font-medium text-red-700 hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "▾" : "▸"} Zona de peligro
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-stone-600">
            Borra <strong>todos</strong> los {count} empleado(s) de <strong>{localName}</strong> y
            todos sus datos (fichajes, vacaciones, ausencias, documentos, incidencias, cuentas de
            acceso, formación...). La configuración (local, año de vacaciones, semanas bloqueadas,
            plantillas) no se toca. <strong className="text-red-700">No se puede deshacer.</strong>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="label">Escribe BORRAR para confirmar</label>
              <input
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="BORRAR"
              />
            </div>
            <button
              className="btn-danger"
              disabled={pending || confirm !== "BORRAR"}
              onClick={go}
            >
              {pending ? "Borrando…" : `Borrar los ${count} empleados de ${localName}`}
            </button>
          </div>
          {result?.error && <p className="text-red-600">{result.error}</p>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { provisionAccess } from "../actions";

export default function AccessPanel({
  employeeId,
  canCreateEncargado,
}: {
  employeeId: string;
  canCreateEncargado: boolean;
}) {
  const [role, setRole] = useState<"EMPLEADO" | "ENCARGADO">("EMPLEADO");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; password?: string; email?: string }>();

  function go() {
    start(async () => setResult(await provisionAccess(employeeId, role)));
  }

  if (result?.password) {
    return (
      <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
        <p className="font-medium text-green-800">Acceso creado.</p>
        <p className="mt-1 text-stone-700">
          Email: <code className="font-mono">{result.email}</code>
        </p>
        <p className="text-stone-700">
          Contraseña temporal: <code className="font-mono text-base bg-white px-1.5 py-0.5 rounded border">{result.password}</code>
        </p>
        <p className="text-xs text-stone-500 mt-2">
          Cópiala y entrégala al empleado — no volverá a mostrarse. Deberá cambiarla al entrar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="access-role">Rol de acceso</label>
        <select
          id="access-role"
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value as "EMPLEADO" | "ENCARGADO")}
        >
          <option value="EMPLEADO">Empleado</option>
          {canCreateEncargado && <option value="ENCARGADO">Encargado</option>}
        </select>
      </div>
      <button className="btn-primary" onClick={go} disabled={pending}>
        {pending ? "Creando…" : "Dar acceso"}
      </button>
      {result?.error && <p className="w-full text-sm text-red-600">{result.error}</p>}
    </div>
  );
}

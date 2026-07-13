"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createUser, setUserActive, resetUserPassword, setUserLocal } from "./actions";

export function LocalSelect({
  userId,
  currentLocalId,
  locals,
}: {
  userId: string;
  currentLocalId: string | null;
  locals: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <select
        className="input text-xs py-1"
        value={currentLocalId ?? ""}
        disabled={pending}
        onChange={(e) => start(async () => { const r = await setUserLocal(userId, e.target.value); setError(r.error); })}
      >
        <option value="" disabled>—</option>
        {locals.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

function Sub() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Creando…" : "Crear cuenta"}</button>;
}

function TempPasswordBox({ email, password }: { email: string; password: string }) {
  return (
    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm mt-2">
      <p className="text-stone-700">Cuenta: <code className="font-mono">{email}</code></p>
      <p className="text-stone-700">Contraseña temporal: <code className="font-mono text-base bg-white px-1.5 py-0.5 rounded border">{password}</code></p>
      <p className="text-xs text-stone-500 mt-1">Cópiala y entrégala — no se volverá a mostrar. Deberá cambiarla al entrar.</p>
    </div>
  );
}

export function CreateUserForm({ locals }: { locals: { id: string; name: string }[] }) {
  const [state, action] = useFormState(createUser, {});
  const [role, setRole] = useState("ENCARGADO");
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">Nueva cuenta de acceso</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" className="input" required />
        </div>
        <div>
          <label className="label">Rol</label>
          <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="ENCARGADO">Encargado</option>
            <option value="GESTORIA">Gestoría</option>
            <option value="SUPERADMIN">Superadmin</option>
          </select>
        </div>
        <div>
          <label className="label">Local</label>
          <select name="localId" className="input" disabled={role === "SUPERADMIN"}>
            <option value="">—</option>
            {locals.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.password && state.email && <TempPasswordBox email={state.email} password={state.password} />}
      <Sub />
    </form>
  );
}

export function UserActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [reset, setReset] = useState<{ email?: string; password?: string; error?: string }>();
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button className="btn-secondary text-xs px-2 py-1" disabled={pending} onClick={() => start(async () => setReset(await resetUserPassword(id)))}>
          Reset contraseña
        </button>
        <button className={`text-xs px-2 py-1 ${active ? "btn-danger" : "btn-primary"}`} disabled={pending} onClick={() => start(() => setUserActive(id, !active))}>
          {active ? "Desactivar" : "Reactivar"}
        </button>
      </div>
      {reset?.error && <p className="text-xs text-red-600">{reset.error}</p>}
      {reset?.password && (
        <p className="text-xs text-green-700">Nueva contraseña: <code className="font-mono bg-white px-1 rounded border">{reset.password}</code></p>
      )}
    </div>
  );
}

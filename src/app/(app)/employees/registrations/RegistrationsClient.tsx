"use client";

import { useState, useTransition } from "react";
import { createInvite, approveRegistration, rejectRegistration } from "./actions";

export function InviteForm({
  locals,
  fixedLocalId,
}: {
  locals: { id: string; code: string; name: string }[];
  fixedLocalId?: string;
}) {
  const [localId, setLocalId] = useState(fixedLocalId ?? locals[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; ok?: boolean; url?: string; emailError?: string }>();

  function go() {
    start(async () => {
      const res = await createInvite(localId, email);
      setResult(res);
      if (res.ok) setEmail("");
    });
  }

  return (
    <div className="card p-4 space-y-3">
      <h2 className="font-semibold">Invitar a un empleado a autorregistrarse</h2>
      <p className="text-sm text-stone-500">
        Le llega un enlace de un solo uso por email. Rellena él mismo todos sus datos; tú apruebas
        antes de que reciba el acceso.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {!fixedLocalId && (
          <div>
            <label className="label">Local</label>
            <select className="input" value={localId} onChange={(e) => setLocalId(e.target.value)}>
              {locals.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1 min-w-[14rem]">
          <label className="label">Email del futuro empleado</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <button className="btn-primary" onClick={go} disabled={pending || !email}>
          {pending ? "Enviando…" : "Enviar invitación"}
        </button>
      </div>
      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      {result?.ok && result.emailError && (
        <p className="text-sm text-red-600">
          El enlace se ha creado, pero el email no se pudo enviar ({result.emailError}). Comparte
          este enlace a mano:{" "}
          <code className="font-mono text-xs bg-white px-1 rounded border">{result.url}</code>
        </p>
      )}
      {result?.ok && !result.emailError && (
        <p className="text-sm text-green-700">
          Invitación enviada. Si el email no le llega, comparte este enlace directamente:{" "}
          <code className="font-mono text-xs bg-white px-1 rounded border">{result.url}</code>
        </p>
      )}
    </div>
  );
}

export function RegistrationRow({ id, canDecide }: { id: string; canDecide: boolean }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [result, setResult] = useState<{ error?: string; ok?: boolean; password?: string; email?: string; emailError?: string }>();

  function approve() {
    start(async () => setResult(await approveRegistration(id)));
  }
  function reject() {
    start(async () => setResult(await rejectRegistration(id, note)));
  }

  if (result?.ok && result.password) {
    return (
      <div className={`rounded-md border p-3 text-sm ${result.emailError ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
        <p className={`font-medium ${result.emailError ? "text-amber-800" : "text-green-800"}`}>
          {result.emailError
            ? `Aprobado, pero el email a ${result.email} no se pudo enviar (${result.emailError}).`
            : `Aprobado. Acceso creado y enviado por email a ${result.email}.`}
        </p>
        <p className="text-xs text-stone-500 mt-1">
          Contraseña temporal{result.emailError ? " — entrégala tú a mano" : " (por si el email no llega)"}:{" "}
          <code className="font-mono bg-white px-1 rounded border">{result.password}</code>
        </p>
      </div>
    );
  }
  if (result?.ok) {
    return <p className="text-sm text-stone-500">Rechazada.</p>;
  }

  if (!canDecide) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button className="btn-primary text-xs px-2 py-1" disabled={pending} onClick={approve}>
          Aprobar
        </button>
        <button className="btn-danger text-xs px-2 py-1" disabled={pending} onClick={() => setShowReject((v) => !v)}>
          Rechazar
        </button>
      </div>
      {showReject && (
        <div className="flex gap-2 items-center">
          <input
            className="input text-xs py-1"
            placeholder="Motivo (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn-danger text-xs px-2 py-1" disabled={pending} onClick={reject}>
            Confirmar rechazo
          </button>
        </div>
      )}
      {result?.error && <p className="text-xs text-red-600">{result.error}</p>}
    </div>
  );
}

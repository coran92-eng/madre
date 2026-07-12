"use client";

import { useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { uploadDocument, acknowledgeDocument } from "./actions";

function UploadBtn() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Subiendo…" : "Subir documento"}</button>;
}

export function UploadForm({ employees }: { employees: { id: string; name: string }[] }) {
  const [state, action] = useFormState(uploadDocument, {});
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">Subir documento</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Empleado</label>
          <select name="employeeId" className="input" required>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipo</label>
          <select name="type" className="input" defaultValue="NOMINA">
            <option value="NOMINA">Nómina</option>
            <option value="CONTRATO">Contrato</option>
            <option value="ANEXO">Anexo</option>
            <option value="AMONESTACION">Amonestación</option>
            <option value="COMUNICACION">Comunicación</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div>
          <label className="label">Título</label>
          <input name="title" className="input" placeholder="Nómina julio 2026" required />
        </div>
        <div>
          <label className="label">Periodo (opcional)</label>
          <input name="period" className="input" placeholder="2026-07" />
        </div>
      </div>
      <div>
        <label className="label">Archivo (PDF, PNG, JPG · máx 12 MB)</label>
        <input name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="input" required />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="requiresAck" type="checkbox" defaultChecked />
        Requiere confirmación de recepción (firma simple)
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Documento subido.</p>}
      <UploadBtn />
    </form>
  );
}

export function AckButton({ documentId }: { documentId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-primary text-xs px-3 py-1.5"
      disabled={pending}
      onClick={() => start(async () => { await acknowledgeDocument(documentId); })}
    >
      {pending ? "…" : "Confirmar recepción"}
    </button>
  );
}

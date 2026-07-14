"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitRegistration, type SubmitResult } from "./actions";

function Field({
  name,
  label,
  type = "text",
  required,
  step,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  step?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} step={step} className="input" required={required} defaultValue={defaultValue} />
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Enviando…" : "Enviar mis datos"}
    </button>
  );
}

export default function JoinForm({ token, email }: { token: string; email: string }) {
  const action = submitRegistration.bind(null, token);
  const [state, formAction] = useFormState<SubmitResult, FormData>(action, {});

  if (state.ok) {
    return (
      <div className="card p-6 text-center">
        <h2 className="font-semibold text-green-800">¡Gracias!</h2>
        <p className="text-sm text-stone-600 mt-2">
          Hemos recibido tus datos. Un responsable los revisará y te llegará el acceso por email
          a <strong>{email}</strong> en cuanto se apruebe.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="card p-4 text-sm text-stone-500">
        Este alta es para <strong className="text-stone-700">{email}</strong>. Rellena tus datos —
        tu responsable los revisará antes de darte acceso.
      </div>

      <fieldset className="card p-4 space-y-3">
        <legend className="font-semibold px-1">Datos esenciales</legend>
        <div className="grid md:grid-cols-2 gap-3">
          <Field name="firstName" label="Nombre" required />
          <Field name="lastName" label="Apellidos" required />
          <Field name="phone" label="Teléfono" required />
          <Field name="startDate" label="Fecha de inicio de contrato" type="date" required />
        </div>
      </fieldset>

      <details className="card p-4">
        <summary className="font-semibold px-1 cursor-pointer select-none">
          Datos adicionales (opcional, tu responsable puede completarlos luego)
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <Field name="nif" label="NIF / NIE" />
            <Field name="ssNumber" label="Nº Seguridad Social" />
            <Field name="iban" label="IBAN" />
            <Field name="emergencyContact" label="Contacto de emergencia" />
            <Field name="emergencyPhone" label="Tel. emergencia" />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="contractType">Tipo de contrato</label>
              <select id="contractType" name="contractType" className="input" defaultValue="INDEFINIDO">
                <option value="INDEFINIDO">Indefinido</option>
                <option value="TEMPORAL">Temporal</option>
                <option value="FIJO_DISCONTINUO">Fijo discontinuo</option>
                <option value="FORMACION">Formación</option>
                <option value="PRACTICAS">Prácticas</option>
              </select>
            </div>
            <Field name="weeklyHours" label="Jornada (h/semana)" type="number" step="0.5" defaultValue="40" />
          </div>
        </div>
      </details>

      {state.error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">{state.error}</p>}
      <Submit />
    </form>
  );
}

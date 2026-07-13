"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { FormResult } from "./actions";

type Local = { id: string; code: string; name: string };
type Employee = {
  id: string;
  localId: string;
  firstName: string;
  lastName: string;
  nif: string | null;
  ssNumber: string | null;
  iban: string | null;
  phone: string | null;
  email: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  contractType: string;
  weeklyHours: number;
  startDate: string; // yyyy-mm-dd
  endDate: string | null;
  trialEndDate: string | null;
  status: string;
  vacationDaysOverride: number | null;
  hourlyCostOverride: number | null;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Guardando…" : label}
    </button>
  );
}

export default function EmployeeForm({
  action,
  locals,
  fixedLocalId,
  employee,
  submitLabel,
}: {
  action: (prev: FormResult, fd: FormData) => Promise<FormResult>;
  locals: Local[];
  fixedLocalId?: string;
  employee?: Employee;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState<FormResult, FormData>(action, {});
  const e = employee;

  return (
    <form action={formAction} className="space-y-6">
      {/* Local */}
      {fixedLocalId ? (
        <input type="hidden" name="localId" value={fixedLocalId} />
      ) : (
        <div className="card p-4">
          <label className="label" htmlFor="localId">Local</label>
          <select id="localId" name="localId" className="input" defaultValue={e?.localId ?? locals[0]?.id} required>
            {locals.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="card p-4 space-y-3">
        <legend className="font-semibold px-1">Datos personales</legend>
        <div className="grid md:grid-cols-2 gap-3">
          <Field name="firstName" label="Nombre" defaultValue={e?.firstName} required />
          <Field name="lastName" label="Apellidos" defaultValue={e?.lastName} required />
          <Field name="nif" label="NIF / NIE" defaultValue={e?.nif} />
          <Field name="ssNumber" label="Nº Seguridad Social" defaultValue={e?.ssNumber} />
          <Field name="iban" label="IBAN" defaultValue={e?.iban} />
          <Field name="phone" label="Teléfono" defaultValue={e?.phone} />
          <Field name="email" label="Email (para acceso)" type="email" defaultValue={e?.email} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field name="emergencyContact" label="Contacto de emergencia" defaultValue={e?.emergencyContact} />
          <Field name="emergencyPhone" label="Tel. emergencia" defaultValue={e?.emergencyPhone} />
        </div>
      </fieldset>

      <fieldset className="card p-4 space-y-3">
        <legend className="font-semibold px-1">Contrato</legend>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="contractType">Tipo de contrato</label>
            <select id="contractType" name="contractType" className="input" defaultValue={e?.contractType ?? "INDEFINIDO"}>
              <option value="INDEFINIDO">Indefinido</option>
              <option value="TEMPORAL">Temporal</option>
              <option value="FIJO_DISCONTINUO">Fijo discontinuo</option>
              <option value="FORMACION">Formación</option>
              <option value="PRACTICAS">Prácticas</option>
            </select>
          </div>
          <Field name="weeklyHours" label="Jornada (h/semana)" type="number" step="0.5" defaultValue={e ? String(e.weeklyHours) : "40"} />
          <Field name="startDate" label="Fecha de alta" type="date" defaultValue={e?.startDate} required />
          <Field name="endDate" label="Fin de contrato (opcional)" type="date" defaultValue={e?.endDate ?? ""} />
          <Field name="trialEndDate" label="Fin período de prueba (opcional)" type="date" defaultValue={e?.trialEndDate ?? ""} />
          <div>
            <label className="label" htmlFor="status">Estado</label>
            <select id="status" name="status" className="input" defaultValue={e?.status ?? "ACTIVO"}>
              <option value="ACTIVO">Activo</option>
              <option value="EXCEDENCIA">Excedencia</option>
              <option value="BAJA">Baja</option>
            </select>
          </div>
          <Field name="vacationDaysOverride" label="Días vacaciones (override)" type="number" defaultValue={e?.vacationDaysOverride != null ? String(e.vacationDaysOverride) : ""} />
          <Field name="hourlyCostOverride" label="Coste/hora (€, opcional)" type="number" step="0.01" defaultValue={e?.hourlyCostOverride != null ? String(e.hourlyCostOverride) : ""} />
        </div>
      </fieldset>

      {state.error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700 bg-green-50 rounded-md p-2">Guardado.</p>}
      <Submit label={submitLabel} />
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required,
  step,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | null;
  required?: boolean;
  step?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} step={step} className="input" defaultValue={defaultValue ?? ""} required={required} />
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveCourse, toggleCourse, recordCompletion, deleteCompletion } from "./actions";

function Sub({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : label}</button>;
}

export function CourseForm({
  course,
}: {
  course?: { id: string; name: string; validityMonths: number | null };
}) {
  const [state, action] = useFormState(saveCourse, {});
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">{course ? "Editar curso" : "Nuevo curso"}</h2>
      {course && <input type="hidden" name="id" value={course.id} />}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Nombre del curso</label>
          <input name="name" className="input" defaultValue={course?.name} placeholder="Manipulador de alimentos, PRL…" required />
        </div>
        <div>
          <label className="label">Validez (meses)</label>
          <input name="validityMonths" type="number" min="1" className="input" defaultValue={course?.validityMonths ?? ""} placeholder="Sin caducidad" />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Curso guardado.</p>}
      <Sub label={course ? "Guardar cambios" : "Crear curso"} />
    </form>
  );
}

export function ToggleCourse({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      className={active ? "text-xs text-red-600 hover:underline" : "text-xs text-madre hover:underline"}
      disabled={pending}
      onClick={() => start(() => toggleCourse(id, !active))}
    >
      {active ? "Desactivar" : "Activar"}
    </button>
  );
}

export function CompletionForm({
  courses,
  employees,
}: {
  courses: { id: string; name: string }[];
  employees: { id: string; name: string }[];
}) {
  const [state, action] = useFormState(recordCompletion, {});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="card p-4 space-y-3">
      <h2 className="font-semibold">Registrar formación completada</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Curso</label>
          <select name="courseId" className="input" required>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Empleado</label>
          <select name="employeeId" className="input" required>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Fecha de realización</label>
          <input name="completedOn" type="date" className="input" defaultValue={today} required />
        </div>
        <div>
          <label className="label">Certificado (opcional)</label>
          <input name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="input" />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Formación registrada.</p>}
      <Sub label="Registrar formación" />
    </form>
  );
}

export function DeleteCompletion({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(() => deleteCompletion(id))}>Eliminar</button>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { PageHeader, StatusBadge, fmtDate } from "@/components/ui";
import EmployeeForm from "../EmployeeForm";
import AccessPanel from "./AccessPanel";
import { PinPanel, ExpiryPanel, PurgeButton } from "./ExtraPanels";
import { IncidentForm, DeleteIncident } from "../../incidents/IncidentsClient";
import { updateEmployee, deactivateEmployee, reactivateEmployee } from "../actions";

function toInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function EmployeeDetail({ params }: { params: { id: string } }) {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const e = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      local: true,
      user: { select: { id: true, email: true, role: true, active: true } },
      expiries: { orderBy: { dueDate: "asc" } },
      incidents: { orderBy: { date: "desc" } },
    },
  });
  if (!e || !canAccessLocal(user, e.localId)) notFound();

  const locals = await prisma.local.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        title={`${e.firstName} ${e.lastName}`}
        subtitle={`${e.local.name} · ${e.contractType}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={e.status} />
            <Link href="/employees" className="btn-secondary">Volver</Link>
          </div>
        }
      />

      {/* Access */}
      <div className="card p-4 mb-6">
        <h2 className="font-semibold mb-3">Acceso a la plataforma</h2>
        {e.user ? (
          <p className="text-sm text-stone-600">
            Cuenta activa: <code className="font-mono">{e.user.email}</code> ·{" "}
            <span className="badge bg-stone-100 text-stone-700">{e.user.role}</span>{" "}
            {!e.user.active && <span className="text-red-600">(desactivada)</span>}
          </p>
        ) : e.deletedAt ? (
          <p className="text-sm text-stone-500">Empleado en histórico — sin acceso.</p>
        ) : (
          <AccessPanel employeeId={e.id} canCreateEncargado={user.role === "SUPERADMIN"} />
        )}
      </div>

      {/* Quick facts */}
      <div className="grid md:grid-cols-3 gap-3 mb-6 text-sm">
        <Fact label="NIF/NIE" value={e.nif} />
        <Fact label="Nº SS" value={e.ssNumber} />
        <Fact label="IBAN" value={e.iban} />
        <Fact label="Teléfono" value={e.phone} />
        <Fact label="Alta" value={fmtDate(e.startDate)} />
        <Fact label="Fin contrato" value={e.endDate ? fmtDate(e.endDate) : "—"} />
        <Fact label="Emergencia" value={e.emergencyContact ? `${e.emergencyContact} · ${e.emergencyPhone ?? ""}` : "—"} />
      </div>

      {/* Edit */}
      {!e.deletedAt && (
        <section className="mb-6">
          <h2 className="font-semibold mb-3">Editar ficha</h2>
          <EmployeeForm
            action={updateEmployee.bind(null, e.id)}
            locals={locals}
            fixedLocalId={user.role === "SUPERADMIN" ? undefined : e.localId}
            submitLabel="Guardar cambios"
            employee={{
              id: e.id,
              localId: e.localId,
              firstName: e.firstName,
              lastName: e.lastName,
              nif: e.nif,
              ssNumber: e.ssNumber,
              iban: e.iban,
              phone: e.phone,
              email: e.email,
              emergencyContact: e.emergencyContact,
              emergencyPhone: e.emergencyPhone,
              contractType: e.contractType,
              weeklyHours: e.weeklyHours,
              startDate: toInput(e.startDate),
              endDate: toInput(e.endDate),
              trialEndDate: toInput(e.trialEndDate),
              status: e.status,
              vacationDaysOverride: e.vacationDaysOverride,
            }}
          />
        </section>
      )}

      {/* Fichaje PIN + caducidades */}
      {!e.deletedAt && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="card p-4">
            <h2 className="font-semibold mb-3">Fichaje (tablet)</h2>
            <PinPanel employeeId={e.id} hasPin={!!e.pinHash} />
          </div>
          <div className="card p-4">
            <h2 className="font-semibold mb-3">Caducidades</h2>
            <ExpiryPanel
              employeeId={e.id}
              expiries={e.expiries.map((x) => ({ id: x.id, type: x.type, label: x.label, dueDate: toInput(x.dueDate), resolved: x.resolved }))}
            />
          </div>
        </div>
      )}

      {/* Incidencias (solo admin) */}
      <section className="mb-6">
        <h2 className="font-semibold mb-3">Registro de incidencias</h2>
        {!e.deletedAt && <div className="mb-3"><IncidentForm fixedEmployeeId={e.id} /></div>}
        {e.incidents.length === 0 ? (
          <p className="text-sm text-stone-500">Sin incidencias.</p>
        ) : (
          <div className="card divide-y divide-stone-100">
            {e.incidents.map((i) => (
              <div key={i.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs text-stone-400">{fmtDate(i.date)}{i.category ? ` · ${i.category}` : ""}</div>
                  <div className="flex items-center gap-3">
                    {i.storageKey && <a href={`/api/incidents/${i.id}/file`} target="_blank" className="text-madre hover:underline text-xs">Adjunto</a>}
                    <DeleteIncident id={i.id} />
                  </div>
                </div>
                <p className="text-sm text-stone-700 whitespace-pre-wrap mt-1">{i.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Danger / lifecycle */}
      <div className="card p-4 border-stone-200">
        {e.deletedAt ? (
          <form action={reactivateEmployee.bind(null, e.id)} className="flex items-center justify-between">
            <div>
              <p className="font-medium">En histórico</p>
              <p className="text-sm text-stone-500">Baja el {fmtDate(e.deletedAt)}. Los datos se conservan 4 años.</p>
            </div>
            <button className="btn-secondary">Reactivar</button>
          </form>
        ) : (
          <form action={deactivateEmployee.bind(null, e.id)} className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dar de baja</p>
              <p className="text-sm text-stone-500">Baja lógica: se revoca el acceso pero se conserva el histórico.</p>
            </div>
            <button className="btn-danger">Dar de baja</button>
          </form>
        )}
      </div>

      {/* Derechos ARCO (RGPD §5) */}
      <div className="card p-4 mt-4">
        <h2 className="font-semibold mb-1">Datos personales (RGPD / ARCO)</h2>
        <p className="text-sm text-stone-500 mb-3">
          Exporta todos los datos del empleado. El borrado definitivo solo procede tras cumplir los plazos legales de conservación (≥ 4 años).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a href={`/api/employees/${e.id}/arco`} className="btn-secondary" target="_blank">Exportar datos (JSON)</a>
          {user.role === "SUPERADMIN" && e.deletedAt && <PurgeButton employeeId={e.id} />}
        </div>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="card p-3">
      <div className="text-xs uppercase tracking-wide text-stone-400">{label}</div>
      <div className="text-stone-800 mt-0.5">{value || "—"}</div>
    </div>
  );
}

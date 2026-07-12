import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, localScope, ROLE_LABELS } from "@/lib/rbac";
import { capacityCheck, employeeBalance } from "@/lib/vacations";
import { PageHeader, Stat } from "@/components/ui";

export default async function Dashboard() {
  const user = await requireUser();
  const year = new Date().getUTCFullYear();

  return (
    <>
      <PageHeader
        title={`Hola`}
        subtitle={`${user.email} · ${ROLE_LABELS[user.role]}`}
      />
      {isAdmin(user) ? <AdminHome userLocalId={user.localId} year={year} isSuper={user.role === "SUPERADMIN"} /> : <EmployeeHome userId={user.id} year={year} />}
    </>
  );
}

async function AdminHome({ userLocalId, year, isSuper }: { userLocalId: string | null; year: number; isSuper: boolean }) {
  const scope = isSuper ? {} : { localId: userLocalId ?? "__none__" };
  const [employees, pendingVac, pendingDocs] = await Promise.all([
    prisma.employee.count({ where: { ...scope, deletedAt: null } }),
    prisma.vacationRequest.count({ where: { ...scope, status: "PENDIENTE" } }),
    prisma.document.count({ where: { ...scope, requiresAck: true, acks: { none: {} } } }),
  ]);

  // Capacity report for the admin's local (superadmin: skip, multi-local).
  const capacity = userLocalId ? await capacityCheck(userLocalId, year) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Empleados activos" value={employees} />
        <Stat label="Vacaciones pendientes" value={pendingVac} hint="por aprobar" />
        <Stat label="Documentos sin firmar" value={pendingDocs} />
      </div>

      {capacity && (
        <div className={`card p-4 ${capacity.ok ? "" : "border-red-300 bg-red-50"}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Validador de capacidad · Vacaciones {year}</h2>
            <span className={`badge ${capacity.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
              {capacity.ok ? "Cabe" : "No cabe"}
            </span>
          </div>
          <p className="text-sm text-stone-600 mt-2">
            {capacity.activeEmployees} empleados × {capacity.weeksPerEmployee} semanas ={" "}
            <strong>{capacity.weeksRequired}</strong> semanas necesarias ·{" "}
            <strong>{capacity.availableWeeks}</strong> disponibles ({capacity.totalWeeks} − {capacity.blockedWeeks} bloqueadas).
          </p>
          {!capacity.ok && (
            <p className="text-sm text-red-700 mt-1">
              Faltan {capacity.deficit} semanas. Ajusta semanas/persona o fechas bloqueadas antes de abrir solicitudes.{" "}
              <Link href="/vacations/config" className="underline">Configurar</Link>
            </p>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <QuickLink href="/employees" title="Empleados" desc="Alta, edición y baja de personal." />
        <QuickLink href="/vacations/approvals" title="Aprobaciones" desc="Vacaciones y ajustes pendientes." />
        <QuickLink href="/schedule" title="Horarios" desc="Cuadrante semanal por empleado." />
        <QuickLink href="/documents" title="Documentos" desc="Subir nóminas y contratos." />
      </div>
    </div>
  );
}

async function EmployeeHome({ userId, year }: { userId: string; year: number }) {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee) {
    return (
      <div className="card p-6 text-stone-600">
        Tu cuenta aún no está vinculada a una ficha de empleado. Contacta con tu encargado.
      </div>
    );
  }
  const balance = await employeeBalance(employee.id, year);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Derecho anual" value={`${balance.entitlementDays} d`} hint={`devengado: ${balance.accruedDays} d`} />
        <Stat label="Disfrutados" value={`${balance.consumedDays} d`} />
        <Stat label="Pendientes aprobar" value={`${balance.pendingDays} d`} />
        <Stat label="Saldo" value={`${balance.balanceDays} d`} hint={balance.adjustmentDays ? `incluye +${balance.adjustmentDays} de bolsa` : undefined} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <QuickLink href="/vacations" title="Mis vacaciones" desc="Solicitar semanas y ver el calendario compartido." />
        <QuickLink href="/schedule" title="Mi horario" desc="Tus turnos publicados." />
        <QuickLink href="/documents" title="Mis documentos" desc="Nóminas y contratos. Confirma recepción." />
      </div>
    </div>
  );
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card p-4 hover:border-madre transition block">
      <div className="font-semibold text-stone-900">{title}</div>
      <div className="text-sm text-stone-500 mt-1">{desc}</div>
    </Link>
  );
}

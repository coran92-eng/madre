import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin, ROLE_LABELS } from "@/lib/rbac";
import { capacityCheck, employeeBalance } from "@/lib/vacations";
import { getActiveLocalId, getListScope } from "@/lib/localcontext";
import { gatherAlerts } from "@/lib/alerts";
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
      {isAdmin(user) ? (
        <AdminHome user={user} year={year} />
      ) : user.role === "GESTORIA" ? (
        <GestoriaHome />
      ) : (
        <EmployeeHome userId={user.id} year={year} />
      )}
    </>
  );
}

async function AdminHome({ user, year }: { user: Awaited<ReturnType<typeof requireUser>>; year: number }) {
  const scope = await getListScope(user);
  const [employees, pendingVac, pendingDocs, pendingAbs, alerts] = await Promise.all([
    prisma.employee.count({ where: { ...scope, deletedAt: null } }),
    prisma.vacationRequest.count({ where: { ...scope, status: "PENDIENTE" } }),
    prisma.document.count({ where: { ...scope, requiresAck: true, acks: { none: {} } } }),
    prisma.absence.count({ where: { ...scope, status: "PENDIENTE" } }),
    gatherAlerts(user, 30),
  ]);

  // Capacity report for the active local (multi-local via switcher).
  const activeLocalId = await getActiveLocalId(user);
  const capacity = activeLocalId ? await capacityCheck(activeLocalId, year) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Empleados activos" value={employees} />
        <Stat label="Vacaciones pendientes" value={pendingVac} hint="por aprobar" />
        <Stat label="Ausencias pendientes" value={pendingAbs} hint="por aprobar" />
        <Stat label="Documentos sin firmar" value={pendingDocs} />
        <Stat label="Caducidades (30 d)" value={alerts.length} hint={alerts.filter((a) => a.overdue).length ? `${alerts.filter((a) => a.overdue).length} vencidas` : undefined} />
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

function GestoriaHome() {
  return (
    <div className="space-y-6">
      <p className="text-stone-600">Acceso de gestoría: subida de nóminas y descarga de registro horario y datos de contratación.</p>
      <div className="grid md:grid-cols-2 gap-4">
        <QuickLink href="/contratacion" title="Contratación" desc="Descargar datos de contratación y registro horario (CSV)." />
        <QuickLink href="/documents" title="Documentos" desc="Subir nóminas y contratos." />
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

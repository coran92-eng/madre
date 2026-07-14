import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { calendarAvailability, getVacationYear, employeeBalance, capacityCheck, dateKey } from "@/lib/vacations";
import { getActiveLocalId } from "@/lib/localcontext";
import { PageHeader, Stat, StatusBadge, fmtDate } from "@/components/ui";
import WeekCalendar from "./WeekCalendar";
import { CancelButton } from "./MyRequests";
import AdjustmentForm from "./AdjustmentForm";

export const dynamic = "force-dynamic";

export default async function VacationsPage({ searchParams }: { searchParams: { year?: string } }) {
  const user = await requireUser();
  const year = Number(searchParams.year) || new Date().getUTCFullYear();

  // Resolve viewing local (superadmin: from the local switcher).
  const localId = await getActiveLocalId(user);
  if (!localId) return <p>No hay locales configurados.</p>;

  const cfg = await getVacationYear(localId, year);
  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });

  const weeks = await calendarAvailability(localId, year, employee?.id);
  const selectable = !!employee && !employee.deletedAt && !!cfg?.requestsOpen;
  const balance = employee && !employee.deletedAt ? await employeeBalance(employee.id, year) : null;

  return (
    <>
      <PageHeader
        title="Vacaciones"
        subtitle={`Año ${year}${cfg ? (cfg.requestsOpen ? " · solicitudes abiertas" : " · solicitudes cerradas") : " · sin configurar"}`}
        action={
          <div className="flex gap-2">
            <Link href={`/vacations?year=${year - 1}`} className="btn-secondary">← {year - 1}</Link>
            <Link href={`/vacations?year=${year + 1}`} className="btn-secondary">{year + 1} →</Link>
            {isAdmin(user) && (
              <>
                <Link href="/vacations/config" className="btn-secondary">Configurar</Link>
                <Link href="/vacations/approvals" className="btn-primary">Aprobaciones</Link>
              </>
            )}
          </div>
        }
      />

      {isAdmin(user) && <AdminBanner localId={localId} year={year} />}

      {employee && !employee.deletedAt && balance && (
        <EmployeeSection employeeId={employee.id} year={year} requestsOpen={!!cfg?.requestsOpen} balance={balance} />
      )}

      {/* Shared calendar (visible to all; only names + dates — spec §4.2) */}
      <section className="mt-8">
        <h2 className="font-semibold mb-1">Calendario compartido</h2>
        <p className="text-sm text-stone-500 mb-3">
          Regla anti-solapamiento: cada día solo puede tenerlo una persona. Selecciona semanas
          completas (lunes-domingo) o días sueltos — útil para el resto de días que no llegan a
          formar una semana entera.
        </p>
        <Legend />
        {/* Employees select here; admins without a ficha see it read-only. */}
        <WeekCalendar
          weeks={weeks}
          year={year}
          selectable={selectable}
          balanceDays={balance?.balanceDays}
          pendingDays={balance?.pendingDays}
        />
      </section>
    </>
  );
}

async function AdminBanner({ localId, year }: { localId: string; year: number }) {
  const cap = await capacityCheck(localId, year);
  return (
    <div className={`card p-3 mb-6 text-sm ${cap.ok ? "" : "border-red-300 bg-red-50"}`}>
      <strong>Capacidad {year}:</strong> {cap.weeksRequired} semanas necesarias / {cap.availableWeeks} disponibles ·{" "}
      {cap.ok ? <span className="text-green-700">cabe</span> : <span className="text-red-700">faltan {cap.deficit} — revisa configuración</span>}
    </div>
  );
}

async function EmployeeSection({
  employeeId,
  year,
  requestsOpen,
  balance,
}: {
  employeeId: string;
  year: number;
  requestsOpen: boolean;
  balance: Awaited<ReturnType<typeof employeeBalance>>;
}) {
  const [requests, adjustments] = await Promise.all([
    prisma.vacationRequest.findMany({
      where: { employeeId, year, status: { not: "CANCELADA" } },
      include: { weeks: { orderBy: { week: "asc" } }, days: { orderBy: { date: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vacationAdjustment.findMany({ where: { employeeId, year }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Derecho anual" value={`${balance.entitlementDays} d`} hint={`devengado: ${balance.accruedDays} d`} />
        <Stat label="Disfrutados" value={`${balance.consumedDays} d`} />
        <Stat label="Pendientes" value={`${balance.pendingDays} d`} />
        <Stat label="Saldo" value={`${balance.balanceDays} d`} hint={balance.adjustmentDays ? `+${balance.adjustmentDays} bolsa` : undefined} />
      </div>

      {!requestsOpen && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-md p-2">
          Las solicitudes aún no están abiertas. Puedes consultar el calendario.
        </p>
      )}

      {requests.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Mis solicitudes</h3>
          <ul className="divide-y divide-stone-100">
            {requests.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">
                    {r.weeks.length > 0 && <>Semanas {r.weeks.map((w) => w.week).join(", ")}</>}
                    {r.weeks.length > 0 && r.days.length > 0 && " + "}
                    {r.days.length > 0 && <>{r.days.length} día(s) suelto(s)</>}
                  </span>
                  <div className="text-xs text-stone-500">
                    {r.weeks.length * 7 + r.days.length} día(s) · solicitado {fmtDate(r.createdAt)}
                    {r.days.length > 0 && <> · {r.days.map((d) => dateKey(d.date)).join(", ")}</>}
                    {r.decisionNote && <> · motivo: {r.decisionNote}</>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  {r.status === "PENDIENTE" && <CancelButton requestId={r.id} />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4">
        <h3 className="font-semibold mb-1">Bolsa de días</h3>
        <p className="text-sm text-stone-500 mb-3">
          Días pendientes de devolución (festivos trabajados, etc.). Requiere aprobación.
        </p>
        <AdjustmentForm year={year} />
        {adjustments.length > 0 && (
          <ul className="mt-4 divide-y divide-stone-100 text-sm">
            {adjustments.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between">
                <span>{a.days > 0 ? `+${a.days}` : a.days} d · {a.reason}</span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    ["bg-green-50 border-green-200", "Disponible"],
    ["bg-madre-50 border-madre-600", "Tuyo"],
    ["bg-stone-100 border-stone-200", "Ocupada"],
    ["bg-amber-50 border-amber-200", "Bloqueada"],
  ] as const;
  return (
    <div className="flex flex-wrap gap-3 mb-3 text-xs text-stone-600">
      {items.map(([c, l]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className={`inline-block w-3 h-3 rounded border ${c}`} />
          {l}
        </span>
      ))}
    </div>
  );
}

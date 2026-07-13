import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLocal } from "@/lib/rbac";
import { getActiveLocalId } from "@/lib/localcontext";
import { capacityCheck, getVacationYear, weekLabel } from "@/lib/vacations";
import { PageHeader } from "@/components/ui";
import { YearForm, RequestsToggle, BlockedWeeks } from "./ConfigForms";

export const dynamic = "force-dynamic";

export default async function VacationConfigPage({ searchParams }: { searchParams: { local?: string; year?: string } }) {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const year = Number(searchParams.year) || new Date().getUTCFullYear();

  // Superadmin: local del selector de la barra lateral (o ?local= explícito).
  const localId = searchParams.local ?? (await getActiveLocalId(user));
  if (!localId || !canAccessLocal(user, localId)) return <p>Local no válido.</p>;
  const local = await prisma.local.findUnique({ where: { id: localId } });

  const cfg = await getVacationYear(localId, year);
  const capacity = await capacityCheck(localId, year);
  const blocked = await prisma.blockedWeek.findMany({
    where: { localId, year },
    orderBy: { week: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Configuración de vacaciones"
        subtitle={`${local?.name ?? ""} · Año ${year}`}
        action={
          <div className="flex gap-2">
            <Link href={`/vacations/config?local=${localId}&year=${year - 1}`} className="btn-secondary">← {year - 1}</Link>
            <Link href={`/vacations/config?local=${localId}&year=${year + 1}`} className="btn-secondary">{year + 1} →</Link>
            <Link href="/vacations" className="btn-secondary">Volver</Link>
          </div>
        }
      />

      {/* Capacity validator */}
      <div className={`card p-4 mb-6 ${capacity.ok ? "" : "border-red-300 bg-red-50"}`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Validador de capacidad</h2>
          <span className={`badge ${capacity.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
            {capacity.ok ? "Cabe" : `Faltan ${capacity.deficit} semanas`}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Metric label="Empleados activos" value={capacity.activeEmployees} />
          <Metric label="Semanas/persona" value={capacity.weeksPerEmployee} />
          <Metric label="Necesarias" value={capacity.weeksRequired} />
          <Metric label="Disponibles" value={`${capacity.availableWeeks} / ${capacity.totalWeeks}`} />
        </div>
        <p className="text-xs text-stone-500 mt-2">
          Valida esto ANTES de abrir solicitudes: así nadie se queda sin vacaciones asignables.
        </p>
      </div>

      {/* Requests open/close */}
      <div className="card p-4 mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Solicitudes</h2>
          <p className="text-sm text-stone-500">
            {cfg?.requestsOpen ? "Abiertas — los empleados pueden solicitar." : "Cerradas."}
          </p>
        </div>
        {cfg ? (
          <RequestsToggle localId={localId} year={year} open={cfg.requestsOpen} />
        ) : (
          <span className="text-sm text-stone-500">Guarda la configuración primero.</span>
        )}
      </div>

      {/* Year config */}
      <div className="card p-4 mb-6">
        <h2 className="font-semibold mb-3">Parámetros del año</h2>
        <YearForm localId={localId} year={year} cfg={cfg} />
      </div>

      {/* Blocked weeks */}
      <div className="card p-4">
        <h2 className="font-semibold mb-1">Fechas bloqueadas (temporada alta)</h2>
        <p className="text-sm text-stone-500 mb-3">Configurables cada año. No hardcodeadas.</p>
        <BlockedWeeks
          localId={localId}
          year={year}
          weeks={blocked.map((b) => ({ id: b.id, week: b.week, reason: b.reason, label: weekLabel(year, b.week) }))}
        />
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-white/60 p-2">
      <div className="text-xs text-stone-400">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

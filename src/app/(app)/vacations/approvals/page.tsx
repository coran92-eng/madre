import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getListScope } from "@/lib/localcontext";
import { PageHeader, EmptyState, fmtDate } from "@/components/ui";
import { VacationDecision, AdjustmentDecision } from "./ApprovalActions";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const scope = await getListScope(user);

  const [requests, adjustments] = await Promise.all([
    prisma.vacationRequest.findMany({
      where: { ...scope, status: "PENDIENTE" },
      include: {
        weeks: { orderBy: { week: "asc" } },
        employee: { select: { firstName: true, lastName: true, startDate: true } },
      },
      orderBy: { createdAt: "asc" }, // orden de solicitud
    }),
    prisma.vacationAdjustment.findMany({
      where: { ...scope, status: "PENDIENTE" },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Priority rule per (local, year) drives ordering of overlapping pending requests (spec §4.2).
  const years = await prisma.vacationYear.findMany({
    where: { OR: requests.map((r) => ({ localId: r.localId, year: r.year })) },
    select: { localId: true, year: true, priorityRule: true },
  });
  const ruleFor = new Map(years.map((y) => [`${y.localId}:${y.year}`, y.priorityRule] as const));
  const RULE_LABEL: Record<string, string> = {
    ORDEN_SOLICITUD: "orden de solicitud", ANTIGUEDAD: "antigüedad", ROTACION: "rotación",
  };

  // Detect weeks requested by more than one pending request (conflicts).
  const weekCount = new Map<string, number>();
  for (const r of requests) for (const w of r.weeks) {
    const k = `${r.localId}:${r.year}:${w.week}`;
    weekCount.set(k, (weekCount.get(k) ?? 0) + 1);
  }
  const decorated = requests.map((r) => {
    const conflictWeeks = r.weeks.filter((w) => (weekCount.get(`${r.localId}:${r.year}:${w.week}`) ?? 0) > 1).map((w) => w.week);
    const rule = ruleFor.get(`${r.localId}:${r.year}`) ?? "ORDEN_SOLICITUD";
    const sortKey = rule === "ANTIGUEDAD" ? r.employee.startDate.getTime() : r.createdAt.getTime();
    return { r, conflictWeeks, rule, sortKey };
  });
  // Conflicts first (to resolve), then by the local's priority rule.
  decorated.sort((a, b) => (b.conflictWeeks.length > 0 ? 1 : 0) - (a.conflictWeeks.length > 0 ? 1 : 0) || a.sortKey - b.sortKey);

  return (
    <>
      <PageHeader
        title="Aprobaciones"
        subtitle="Vacaciones y ajustes pendientes"
        action={<Link href="/vacations" className="btn-secondary">Volver</Link>}
      />

      <h2 className="font-semibold mb-2">Solicitudes de vacaciones</h2>
      {requests.length === 0 ? (
        <EmptyState>No hay solicitudes pendientes.</EmptyState>
      ) : (
        <div className="space-y-3">
          {decorated.map(({ r, conflictWeeks, rule }) => (
            <div key={r.id} className={`card p-4 flex items-start justify-between gap-4 ${conflictWeeks.length ? "border-amber-300 bg-amber-50" : ""}`}>
              <div>
                <div className="font-medium">{r.employee.firstName} {r.employee.lastName}</div>
                <div className="text-sm text-stone-600">
                  Semanas {r.weeks.map((w) => w.week).join(", ")} · {r.weeks.length * 7} días naturales
                </div>
                <div className="text-xs text-stone-400 mt-1">
                  Solicitado {fmtDate(r.createdAt)} · alta empleado {fmtDate(r.employee.startDate)} · prioridad: {RULE_LABEL[rule]}
                </div>
                {conflictWeeks.length > 0 && (
                  <div className="text-xs text-amber-700 mt-1">
                    ⚠ Conflicto en la semana {conflictWeeks.join(", ")}: otra solicitud pendiente la pide. Aprobar una cierra la otra (anti-solapamiento).
                  </div>
                )}
              </div>
              <VacationDecision requestId={r.id} />
            </div>
          ))}
        </div>
      )}

      <h2 className="font-semibold mb-2 mt-8">Ajustes de bolsa de días</h2>
      {adjustments.length === 0 ? (
        <EmptyState>No hay ajustes pendientes.</EmptyState>
      ) : (
        <div className="space-y-3">
          {adjustments.map((a) => (
            <div key={a.id} className="card p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{a.employee.firstName} {a.employee.lastName}</div>
                <div className="text-sm text-stone-600">{a.days > 0 ? `+${a.days}` : a.days} días · {a.reason}</div>
                {a.desiredDate && <div className="text-xs text-stone-400">Disfrute deseado: {fmtDate(a.desiredDate)}</div>}
              </div>
              <AdjustmentDecision id={a.id} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

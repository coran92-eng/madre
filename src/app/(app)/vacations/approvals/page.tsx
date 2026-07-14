import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getListScope } from "@/lib/localcontext";
import { PageHeader, EmptyState, fmtDate } from "@/components/ui";
import { isoWeekDays, dateKey } from "@/lib/vacations";
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
        days: { orderBy: { date: "asc" } },
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

  // Detect dates requested by more than one pending request (conflicts) — a
  // día suelto solapa igual con una semana completa que con otro día suelto.
  const dateCount = new Map<string, number>();
  const requestDates = (r: (typeof requests)[number]) => [
    ...r.weeks.flatMap((w) => isoWeekDays(r.year, w.week)),
    ...r.days.map((d) => d.date),
  ];
  for (const r of requests) {
    for (const d of requestDates(r)) {
      const k = `${r.localId}:${r.year}:${dateKey(d)}`;
      dateCount.set(k, (dateCount.get(k) ?? 0) + 1);
    }
  }
  const decorated = requests.map((r) => {
    const conflictDates = requestDates(r)
      .filter((d) => (dateCount.get(`${r.localId}:${r.year}:${dateKey(d)}`) ?? 0) > 1)
      .map(dateKey);
    const rule = ruleFor.get(`${r.localId}:${r.year}`) ?? "ORDEN_SOLICITUD";
    const sortKey = rule === "ANTIGUEDAD" ? r.employee.startDate.getTime() : r.createdAt.getTime();
    return { r, conflictDates, rule, sortKey };
  });
  // Conflicts first (to resolve), then by the local's priority rule.
  decorated.sort((a, b) => (b.conflictDates.length > 0 ? 1 : 0) - (a.conflictDates.length > 0 ? 1 : 0) || a.sortKey - b.sortKey);

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
          {decorated.map(({ r, conflictDates, rule }) => (
            <div key={r.id} className={`card p-4 flex items-start justify-between gap-4 ${conflictDates.length ? "border-amber-300 bg-amber-50" : ""}`}>
              <div>
                <div className="font-medium">{r.employee.firstName} {r.employee.lastName}</div>
                <div className="text-sm text-stone-600">
                  {r.weeks.length > 0 && <>Semanas {r.weeks.map((w) => w.week).join(", ")}</>}
                  {r.weeks.length > 0 && r.days.length > 0 && " + "}
                  {r.days.length > 0 && <>{r.days.length} día(s) suelto(s) ({r.days.map((d) => dateKey(d.date)).join(", ")})</>}
                  {" · "}{r.weeks.length * 7 + r.days.length} días naturales
                </div>
                <div className="text-xs text-stone-400 mt-1">
                  Solicitado {fmtDate(r.createdAt)} · alta empleado {fmtDate(r.employee.startDate)} · prioridad: {RULE_LABEL[rule]}
                </div>
                {conflictDates.length > 0 && (
                  <div className="text-xs text-amber-700 mt-1">
                    ⚠ Conflicto en {conflictDates.join(", ")}: otra solicitud pendiente lo pide. Aprobar una cierra la otra (anti-solapamiento).
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

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localScope } from "@/lib/rbac";
import { PageHeader, EmptyState, fmtDate } from "@/components/ui";
import { VacationDecision, AdjustmentDecision } from "./ApprovalActions";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const scope = localScope(user);

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
          {requests.map((r) => (
            <div key={r.id} className="card p-4 flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{r.employee.firstName} {r.employee.lastName}</div>
                <div className="text-sm text-stone-600">
                  Semanas {r.weeks.map((w) => w.week).join(", ")} · {r.weeks.length * 7} días naturales
                </div>
                <div className="text-xs text-stone-400 mt-1">
                  Solicitado {fmtDate(r.createdAt)} · alta empleado {fmtDate(r.employee.startDate)}
                </div>
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

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { getListScope } from "@/lib/localcontext";
import { PageHeader, StatusBadge, EmptyState, fmtDate } from "@/components/ui";
import { RequestForm, DecisionButtons, CancelButton } from "./AbsencesClient";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  BAJA_MEDICA: "Baja médica", MATRIMONIO: "Matrimonio", MUDANZA: "Mudanza",
  FALLECIMIENTO: "Fallecimiento", NACIMIENTO: "Nacimiento", DEBER_PUBLICO: "Deber público",
  LACTANCIA: "Lactancia", OTRO: "Otro",
};

export default async function AbsencesPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const employee = admin ? null : await prisma.employee.findUnique({ where: { userId: user.id } });

  return (
    <>
      <PageHeader title={admin ? "Ausencias y permisos" : "Mis ausencias"} subtitle="Bajas médicas y permisos retribuidos" />
      {admin ? <AdminView user={user} /> : <EmployeeView employeeId={employee?.id} />}
    </>
  );
}

async function AdminView({ user }: { user: Awaited<ReturnType<typeof requireUser>> }) {
  const [pending, decided] = await Promise.all([
    prisma.absence.findMany({
      where: { ...(await getListScope(user)), status: "PENDIENTE" },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.absence.findMany({
      where: { ...(await getListScope(user)), status: { not: "PENDIENTE" } },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold mb-2">Pendientes de aprobación</h2>
        {pending.length === 0 ? (
          <EmptyState>No hay ausencias pendientes.</EmptyState>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="card p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{a.employee.firstName} {a.employee.lastName} · {TYPE_LABELS[a.type]}</div>
                  <div className="text-sm text-stone-600">{fmtDate(a.startDate)} → {fmtDate(a.endDate)}</div>
                  {a.reason && <div className="text-xs text-stone-500 mt-0.5">{a.reason}</div>}
                  <div className="text-xs text-amber-700 mt-1">⚠ Revisar cobertura del turno en el cuadrante.</div>
                  {a.justStorageKey && <a href={`/api/absences/${a.id}/justificante`} target="_blank" className="text-madre hover:underline text-xs">Ver justificante</a>}
                </div>
                <DecisionButtons id={a.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Histórico</h2>
        {decided.length === 0 ? (
          <p className="text-sm text-stone-500">Sin registros.</p>
        ) : (
          <div className="card divide-y divide-stone-100">
            {decided.map((a) => (
              <div key={a.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{a.employee.lastName}, {a.employee.firstName}</span> · {TYPE_LABELS[a.type]} · {fmtDate(a.startDate)}→{fmtDate(a.endDate)}
                  {a.decisionNote && <span className="text-stone-400"> · {a.decisionNote}</span>}
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function EmployeeView({ employeeId }: { employeeId?: string }) {
  if (!employeeId) {
    return <div className="card p-6 text-stone-600">Tu cuenta no está vinculada a una ficha de empleado.</div>;
  }
  const absences = await prisma.absence.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <RequestForm />
      {absences.length > 0 && (
        <div className="card divide-y divide-stone-100">
          {absences.map((a) => (
            <div key={a.id} className="p-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{TYPE_LABELS[a.type]}</span> · {fmtDate(a.startDate)} → {fmtDate(a.endDate)}
                {a.decisionNote && <span className="text-stone-400"> · {a.decisionNote}</span>}
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={a.status} />
                {a.status === "PENDIENTE" && <CancelButton id={a.id} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

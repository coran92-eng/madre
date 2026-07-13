import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { getListScope } from "@/lib/localcontext";
import { PageHeader, EmptyState } from "@/components/ui";
import { CheckRow } from "./OnboardingClient";

export const dynamic = "force-dynamic";

function fmtTime(d: Date) {
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

export default async function OnboardingPage() {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");
  const admin = isAdmin(user);
  const scope = await getListScope(user);

  const employees = await prisma.employee.findMany({
    where: { ...scope, deletedAt: null, status: "ACTIVO" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, localId: true },
  });

  // Items de las plantillas activas, agrupados por local.
  const templates = await prisma.onboardingTemplate.findMany({
    where: { ...scope, active: true },
    orderBy: { createdAt: "asc" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const itemsByLocal = new Map<string, { id: string; label: string }[]>();
  for (const t of templates) {
    const arr = itemsByLocal.get(t.localId) ?? [];
    for (const i of t.items) arr.push({ id: i.id, label: i.label });
    itemsByLocal.set(t.localId, arr);
  }

  const employeeIds = employees.map((e) => e.id);
  const checks = employeeIds.length
    ? await prisma.onboardingCheck.findMany({ where: { employeeId: { in: employeeIds } } })
    : [];
  const checkMap = new Map(checks.map((c) => [`${c.employeeId}|${c.itemId}`, c]));

  return (
    <>
      <PageHeader
        title="Onboarding de altas"
        subtitle="Checklist de incorporación por empleado"
        action={admin ? <Link href="/onboarding/config" className="btn-primary">Configurar</Link> : null}
      />

      {employees.length === 0 ? (
        <EmptyState>No hay empleados activos.</EmptyState>
      ) : itemsByLocal.size === 0 ? (
        <EmptyState cta={admin ? { href: "/onboarding/config", label: "Crear plantillas" } : undefined}>
          No hay plantillas de onboarding configuradas.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {employees.map((emp) => {
            const items = itemsByLocal.get(emp.localId) ?? [];
            const doneCount = items.filter((i) => checkMap.get(`${emp.id}|${i.id}`)?.done).length;
            return (
              <div key={emp.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">{emp.firstName} {emp.lastName}</h2>
                  <span className={`text-xs ${doneCount === items.length && items.length > 0 ? "text-green-700" : "text-stone-400"}`}>
                    {doneCount}/{items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-stone-400">Sin tareas para su local.</p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {items.map((i) => {
                      const c = checkMap.get(`${emp.id}|${i.id}`);
                      return (
                        <CheckRow
                          key={i.id}
                          employeeId={emp.id}
                          itemId={i.id}
                          label={i.label}
                          done={!!c?.done}
                          byName={c?.byName}
                          at={c ? fmtTime(c.at) : null}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

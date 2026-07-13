import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gatherAlerts } from "@/lib/alerts";
import { PageHeader, EmptyState, fmtDate } from "@/components/ui";
import ResolveButton from "./ResolveButton";

export const dynamic = "force-dynamic";

export default async function AlertsPage({ searchParams }: { searchParams: { lead?: string } }) {
  const user = await requireRole("SUPERADMIN", "ENCARGADO");

  // Default lead time from the local config; overridable via ?lead=.
  let leadDays = Number(searchParams.lead) || 0;
  if (!leadDays) {
    const local = user.localId ? await prisma.local.findUnique({ where: { id: user.localId } }) : null;
    leadDays = local?.alertLeadDays ?? 30;
  }

  const alerts = await gatherAlerts(user, leadDays);
  const overdue = alerts.filter((a) => a.overdue);
  const upcoming = alerts.filter((a) => !a.overdue);

  return (
    <>
      <PageHeader title="Alertas y caducidades" subtitle={`Próximos ${leadDays} días · contratos, carnets, formación, NIE, período de prueba`} />

      <div className="flex gap-2 mb-4 text-sm">
        {[30, 60, 90].map((d) => (
          <Link key={d} href={`/alerts?lead=${d}`} className={`px-3 py-1 rounded-full ${leadDays === d ? "bg-madre text-white" : "bg-stone-100 text-stone-600"}`}>
            {d} días
          </Link>
        ))}
      </div>

      {alerts.length === 0 ? (
        <EmptyState>Sin caducidades próximas. Todo en regla.</EmptyState>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section>
              <h2 className="font-semibold text-red-700 mb-2">Vencidas ({overdue.length})</h2>
              <AlertList alerts={overdue} />
            </section>
          )}
          <section>
            <h2 className="font-semibold mb-2">Próximas ({upcoming.length})</h2>
            <AlertList alerts={upcoming} />
          </section>
        </div>
      )}
    </>
  );
}

function AlertList({ alerts }: { alerts: Awaited<ReturnType<typeof gatherAlerts>> }) {
  return (
    <div className="card divide-y divide-stone-100">
      {alerts.map((a, i) => (
        <div key={a.expiryId ?? `${a.employeeId}-${i}`} className="p-3 flex items-center justify-between gap-4 text-sm">
          <div>
            <Link href={`/employees/${a.employeeId}`} className="font-medium text-madre hover:underline">{a.employeeName}</Link>
            <span className="text-stone-600"> · {a.kind}</span>
            <div className="text-xs text-stone-400">
              {fmtDate(a.dueDate)} · {a.overdue ? `vencido hace ${Math.abs(a.daysLeft)} días` : `en ${a.daysLeft} días`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${a.overdue ? "bg-red-100 text-red-700" : a.daysLeft <= 7 ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>
              {a.overdue ? "vencido" : `${a.daysLeft}d`}
            </span>
            {a.expiryId && <ResolveButton id={a.expiryId} />}
          </div>
        </div>
      ))}
    </div>
  );
}

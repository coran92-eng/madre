import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { getActiveLocalId, getListScope } from "@/lib/localcontext";
import { PageHeader, Stat, EmptyState, fmtDate } from "@/components/ui";
import { TipPoolForm, DeletePool } from "./TipsClient";

export const dynamic = "force-dynamic";

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const METHOD: Record<string, string> = { EQUAL: "partes iguales", BY_HOURS: "por horas", MANUAL: "manual" };

export default async function TipsPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  return (
    <>
      <PageHeader title="Propinas" subtitle="Reparto del bote por turno" />
      {admin ? <AdminView user={user} /> : <EmployeeView userId={user.id} />}
    </>
  );
}

async function AdminView({ user }: { user: Awaited<ReturnType<typeof requireUser>> }) {
  const localId = await getActiveLocalId(user);
  const scope = await getListScope(user);
  const [employees, pools] = await Promise.all([
    localId ? prisma.employee.findMany({ where: { localId, deletedAt: null, status: "ACTIVO" }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }) : [],
    prisma.tipPool.findMany({
      where: { ...scope },
      orderBy: { businessDate: "desc" },
      take: 40,
      include: { shares: true },
    }),
  ]);

  // Resolve names for shares.
  const empIds = [...new Set(pools.flatMap((p) => p.shares.map((s) => s.employeeId)))];
  const names = new Map(
    (await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, firstName: true, lastName: true } }))
      .map((e) => [e.id, `${e.firstName} ${e.lastName}`])
  );

  return (
    <div className="space-y-6">
      {localId && employees.length > 0 && (
        <TipPoolForm localId={localId} employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }))} />
      )}

      {pools.length === 0 ? (
        <EmptyState>No hay repartos registrados.</EmptyState>
      ) : (
        <div className="space-y-3">
          {pools.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{eur(p.totalAmount)}</span>
                  <span className="text-xs text-stone-400 ml-2">{fmtDate(p.businessDate)}{p.shift ? ` · ${p.shift}` : ""} · {METHOD[p.method]}</span>
                </div>
                <DeletePool id={p.id} />
              </div>
              <ul className="mt-2 text-sm grid sm:grid-cols-2 gap-x-6">
                {p.shares.map((s) => (
                  <li key={s.id} className="flex justify-between py-0.5 border-b border-stone-50">
                    <span>{names.get(s.employeeId) ?? "—"}</span>
                    <span className="font-medium">{eur(s.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function EmployeeView({ userId }: { userId: string }) {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee) return <div className="card p-6 text-stone-600">Tu cuenta no está vinculada a una ficha de empleado.</div>;

  const shares = await prisma.tipShare.findMany({
    where: { employeeId: employee.id },
    include: { pool: true },
    orderBy: { pool: { businessDate: "desc" } },
    take: 60,
  });
  const year = new Date().getUTCFullYear();
  const ytd = shares.filter((s) => s.pool.businessDate.getUTCFullYear() === year).reduce((a, s) => a + s.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Stat label={`Propinas ${year}`} value={eur(ytd)} />
        <Stat label="Repartos" value={shares.length} />
      </div>
      {shares.length === 0 ? (
        <EmptyState>Todavía no tienes propinas registradas.</EmptyState>
      ) : (
        <div className="card divide-y divide-stone-100">
          {shares.map((s) => (
            <div key={s.id} className="p-3 flex items-center justify-between text-sm">
              <span>{fmtDate(s.pool.businessDate)}{s.pool.shift ? ` · ${s.pool.shift}` : ""}</span>
              <span className="font-medium">{eur(s.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

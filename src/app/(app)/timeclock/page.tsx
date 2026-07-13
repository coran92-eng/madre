import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { getListScope } from "@/lib/localcontext";
import { PageHeader, Stat, EmptyState } from "@/components/ui";
import {
  parseMonthKey, monthRange, monthLabel, shiftMonthKey,
  entryMinutes, formatMinutes, fmtTime, fmtDateTime,
} from "@/lib/timeclock";
import CorrectForm from "./CorrectForm";

export const dynamic = "force-dynamic";

export default async function TimeclockPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await requireUser();
  const monthKey = searchParams.month ?? undefined;
  const { year, month } = parseMonthKey(monthKey);
  const { start, end } = monthRange(year, month);
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const admin = isAdmin(user) || user.role === "GESTORIA";

  const employee = admin ? null : await prisma.employee.findUnique({ where: { userId: user.id } });

  const entries = await prisma.timeEntry.findMany({
    where: {
      clockIn: { gte: start, lt: end },
      ...(admin ? await getListScope(user) : { employeeId: employee?.id ?? "__none__" }),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, weeklyHours: true } },
      corrections: { orderBy: { createdAt: "desc" } },
    },
    orderBy: [{ clockIn: "asc" }],
  });

  // Planned minutes this month (from published shifts) → banco de horas.
  const shifts = await prisma.shift.findMany({
    where: { date: { gte: start, lt: end }, ...(admin ? await getListScope(user) : { employeeId: employee?.id ?? "__none__" }) },
    select: { employeeId: true, startTime: true, endTime: true },
  });
  const plannedByEmp = new Map<string, number>();
  for (const s of shifts) {
    const [h1, m1] = s.startTime.split(":").map(Number);
    const [h2, m2] = s.endTime.split(":").map(Number);
    plannedByEmp.set(s.employeeId, (plannedByEmp.get(s.employeeId) ?? 0) + (h2 * 60 + m2 - h1 * 60 - m1));
  }
  const workedByEmp = new Map<string, number>();
  for (const e of entries) {
    workedByEmp.set(e.employee.id, (workedByEmp.get(e.employee.id) ?? 0) + entryMinutes(e.clockIn, e.clockOut));
  }

  const totalWorked = [...workedByEmp.values()].reduce((a, b) => a + b, 0);
  const empName = new Map(entries.map((e) => [e.employee.id, `${e.employee.lastName}, ${e.employee.firstName}`]));

  return (
    <>
      <PageHeader
        title={admin ? "Fichajes" : "Mis fichajes"}
        subtitle={monthLabel(year, month)}
        action={
          <div className="flex gap-2">
            <Link href={`/timeclock?month=${shiftMonthKey(key, -1)}`} className="btn-secondary">←</Link>
            <Link href={`/timeclock?month=${shiftMonthKey(key, 1)}`} className="btn-secondary">→</Link>
            <a href={`/api/timeclock/export?month=${key}`} className="btn-primary">Exportar CSV</a>
          </div>
        }
      />

      {/* Banco de horas */}
      {admin ? (
        <div className="card p-4 mb-6">
          <h2 className="font-semibold mb-2">Banco de horas · {monthLabel(year, month)}</h2>
          {workedByEmp.size === 0 ? (
            <p className="text-sm text-stone-500">Sin fichajes este mes.</p>
          ) : (
            <ul className="text-sm divide-y divide-stone-100">
              {[...workedByEmp.keys()].map((id) => {
                const worked = workedByEmp.get(id) ?? 0;
                const planned = plannedByEmp.get(id) ?? 0;
                const diff = worked - planned;
                return (
                  <li key={id} className="py-1.5 flex items-center justify-between">
                    <span>{empName.get(id)}</span>
                    <span className="text-stone-600">
                      {formatMinutes(worked)} trabajadas / {formatMinutes(planned)} planificadas ·{" "}
                      <span className={diff >= 0 ? "text-green-700" : "text-red-600"}>
                        {diff >= 0 ? "+" : "−"}{formatMinutes(Math.abs(diff))}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Stat label="Total trabajado" value={formatMinutes(totalWorked)} />
          <Stat label="Fichajes" value={entries.length} />
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState>No hay fichajes en {monthLabel(year, month)}.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                {admin && <th className="px-4 py-2 font-medium">Empleado</th>}
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Entrada</th>
                <th className="px-4 py-2 font-medium">Salida</th>
                <th className="px-4 py-2 font-medium">Tiempo</th>
                {admin && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {entries.map((e) => (
                <tr key={e.id} className="align-top">
                  {admin && <td className="px-4 py-2">{empName.get(e.employee.id)}</td>}
                  <td className="px-4 py-2 text-stone-600">{e.clockIn.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}</td>
                  <td className="px-4 py-2">{fmtTime(e.clockIn)}</td>
                  <td className="px-4 py-2">{e.clockOut ? fmtTime(e.clockOut) : <span className="text-amber-600">abierto</span>}</td>
                  <td className="px-4 py-2 text-stone-600">{formatMinutes(entryMinutes(e.clockIn, e.clockOut))}</td>
                  {admin && (
                    <td className="px-4 py-2">
                      <CorrectForm entryId={e.id} />
                      {e.corrections.length > 0 && (
                        <ul className="mt-1 text-xs text-stone-400">
                          {e.corrections.map((c) => (
                            <li key={c.id}>✎ {c.field} → {c.newValue ? fmtDateTime(c.newValue) : "—"} · {c.reason} ({c.authorEmail})</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

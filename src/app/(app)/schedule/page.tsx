import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { AddShiftForm, DeleteShift, PublishButton } from "./ScheduleClient";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Monday (UTC) of the week containing `date`. */
function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(d.getUTCDate() + n);
  return r;
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default async function SchedulePage({ searchParams }: { searchParams: { week?: string } }) {
  const user = await requireUser();
  const localId =
    user.localId ?? (await prisma.local.findFirst({ orderBy: { createdAt: "asc" } }))?.id ?? null;
  if (!localId) return <p>No hay locales configurados.</p>;

  const base = searchParams.week ? new Date(searchParams.week + "T00:00:00Z") : new Date();
  const monday = mondayOf(isNaN(base.getTime()) ? new Date() : base);
  const sunday = addDays(monday, 6);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    return { date: d, iso: iso(d), label: `${DAY_NAMES[i]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` };
  });

  const admin = isAdmin(user);
  const employee = admin ? null : await prisma.employee.findUnique({ where: { userId: user.id } });

  const shifts = await prisma.shift.findMany({
    where: {
      localId,
      date: { gte: monday, lte: sunday },
      ...(admin ? {} : { employeeId: employee?.id ?? "__none__", published: true }),
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true, weeklyHours: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const activeEmployees = admin
    ? await prisma.employee.findMany({
        where: { localId, deletedAt: null, status: "ACTIVO" },
        orderBy: [{ lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, weeklyHours: true },
      })
    : [];

  const unpublished = shifts.filter((s) => !s.published).length;
  const weekLabel = `${monday.getUTCDate()} ${MONTHS[monday.getUTCMonth()]} – ${sunday.getUTCDate()} ${MONTHS[sunday.getUTCMonth()]}`;

  // Planned hours per employee (admin view) → overtime alert vs contract.
  const plannedByEmp = new Map<string, number>();
  for (const s of shifts) {
    const mins = minutes(s.endTime) - minutes(s.startTime);
    plannedByEmp.set(s.employee.id, (plannedByEmp.get(s.employee.id) ?? 0) + mins);
  }

  return (
    <>
      <PageHeader
        title="Horarios"
        subtitle={`Semana ${weekLabel}`}
        action={
          <div className="flex gap-2">
            <Link href={`/schedule?week=${iso(addDays(monday, -7))}`} className="btn-secondary">← Anterior</Link>
            <Link href={`/schedule?week=${iso(addDays(monday, 7))}`} className="btn-secondary">Siguiente →</Link>
          </div>
        }
      />

      {admin && activeEmployees.length > 0 && (
        <div className="space-y-4 mb-6">
          <AddShiftForm
            employees={activeEmployees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }))}
            days={days.map((d) => ({ iso: d.iso, label: d.label }))}
          />
          <div className="flex justify-end">
            <PublishButton localId={localId} fromISO={monday.toISOString()} toISO={sunday.toISOString()} count={unpublished} />
          </div>
        </div>
      )}

      {/* Week grid */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-stone-50 text-stone-500">
            <tr>
              {days.map((d) => (
                <th key={d.iso} className="px-2 py-2 font-medium text-left border-b border-stone-100">{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              {days.map((d) => {
                const dayShifts = shifts.filter((s) => iso(s.date) === d.iso);
                return (
                  <td key={d.iso} className="px-2 py-2 border-r border-stone-50 w-[14%]">
                    <div className="space-y-1">
                      {dayShifts.length === 0 && <span className="text-stone-300 text-xs">—</span>}
                      {dayShifts.map((s) => (
                        <div key={s.id} className={`rounded p-1.5 text-xs ${s.published ? "bg-madre-50 border border-madre-100" : "bg-amber-50 border border-amber-200"}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{s.startTime}–{s.endTime}</span>
                            {admin && <DeleteShift id={s.id} />}
                          </div>
                          {admin && <div className="text-stone-600 truncate">{s.employee.firstName} {s.employee.lastName[0]}.</div>}
                          {s.note && <div className="text-stone-400 truncate">{s.note}</div>}
                          {!s.published && <div className="text-amber-600">sin publicar</div>}
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {admin && plannedByEmp.size > 0 && (
        <div className="card p-4 mt-6">
          <h2 className="font-semibold mb-2">Horas planificadas vs. contrato</h2>
          <ul className="text-sm divide-y divide-stone-100">
            {activeEmployees.map((e) => {
              const planned = (plannedByEmp.get(e.id) ?? 0) / 60;
              const over = planned > e.weeklyHours;
              if (planned === 0) return null;
              return (
                <li key={e.id} className="py-1.5 flex items-center justify-between">
                  <span>{e.lastName}, {e.firstName}</span>
                  <span className={over ? "text-red-600 font-medium" : "text-stone-600"}>
                    {planned.toFixed(1)} h / {e.weeklyHours} h {over && "⚠ exceso"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

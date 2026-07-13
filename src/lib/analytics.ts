import "server-only";
import { prisma } from "./db";
import type { SessionUser } from "./auth";
import { getListScope } from "./localcontext";
import { monthRange } from "./timeclock";
import { netSales, salesPerHour, overlapDays, round2 } from "./panelmath";

export type MonthMetrics = {
  year: number;
  month: number;
  sales: number;
  workedHours: number;
  plannedHours: number;
  salesPerHour: number;
  overtimeHours: number; // trabajadas − planificadas (si > 0)
  tips: number;
  absenceDays: number;
  hires: number;
  terminations: number;
  activeEmployees: number;
};

async function metricsFor(scope: { localId?: string }, year: number, month: number): Promise<MonthMetrics> {
  const { start, end } = monthRange(year, month);

  const [closes, entries, shifts, tipsAgg, absences, hires, terminations, activeEmployees] = await Promise.all([
    prisma.cashClose.findMany({ where: { ...scope, businessDate: { gte: start, lt: end } }, select: { cashCounted: true, openingFloat: true, cardTotal: true, otherTotal: true } }),
    prisma.timeEntry.findMany({ where: { ...scope, clockIn: { gte: start, lt: end }, clockOut: { not: null } }, select: { clockIn: true, clockOut: true } }),
    prisma.shift.findMany({ where: { ...scope, date: { gte: start, lt: end } }, select: { startTime: true, endTime: true } }),
    prisma.tipPool.aggregate({ where: { ...scope, businessDate: { gte: start, lt: end } }, _sum: { totalAmount: true } }),
    prisma.absence.findMany({ where: { ...scope, status: "APROBADA", startDate: { lt: end }, endDate: { gte: start } }, select: { startDate: true, endDate: true } }),
    prisma.employee.count({ where: { ...scope, startDate: { gte: start, lt: end } } }),
    prisma.employee.count({ where: { ...scope, deletedAt: { gte: start, lt: end } } }),
    prisma.employee.count({ where: { ...scope, deletedAt: null, status: "ACTIVO" } }),
  ]);

  const sales = round2(closes.reduce((a, c) => a + netSales(c), 0));
  const workedMin = entries.reduce((a, e) => a + Math.max(0, Math.round((e.clockOut!.getTime() - e.clockIn.getTime()) / 60000)), 0);
  const plannedMin = shifts.reduce((a, s) => {
    const [h1, m1] = s.startTime.split(":").map(Number);
    const [h2, m2] = s.endTime.split(":").map(Number);
    return a + Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1));
  }, 0);
  const lastDayOfMonth = new Date(end.getTime() - 86400000);
  const absenceDays = absences.reduce((a, x) => a + overlapDays(x.startDate, x.endDate, start, lastDayOfMonth), 0);

  return {
    year, month,
    sales,
    workedHours: round2(workedMin / 60),
    plannedHours: round2(plannedMin / 60),
    salesPerHour: round2(salesPerHour(sales, workedMin)),
    overtimeHours: round2(Math.max(0, (workedMin - plannedMin) / 60)),
    tips: round2(tipsAgg._sum.totalAmount ?? 0),
    absenceDays,
    hires,
    terminations,
    activeEmployees,
  };
}

/** Metrics for a month + the trailing 6-month trend, scoped to the user's locals. */
export async function panelData(user: SessionUser, year: number, month: number) {
  const scope = await getListScope(user);
  const current = await metricsFor(scope, year, month);

  const trend: MonthMetrics[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    trend.push(await metricsFor(scope, d.getUTCFullYear(), d.getUTCMonth() + 1));
  }
  return { current, trend };
}

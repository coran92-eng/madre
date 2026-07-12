import "server-only";
import { prisma } from "./db";
import type { SessionUser } from "./auth";
import { localScope } from "./rbac";

export type Alert = {
  employeeId: string;
  employeeName: string;
  kind: string;
  dueDate: Date;
  daysLeft: number;
  overdue: boolean;
  expiryId?: string;
};

const EXPIRY_LABELS: Record<string, string> = {
  CARNET_MANIPULADOR: "Carnet manipulador de alimentos",
  FORMACION_ALERGENOS: "Formación de alérgenos",
  NIE: "NIE",
  DNI: "DNI",
  CONTRATO_TEMPORAL: "Contrato temporal",
  PERIODO_PRUEBA: "Período de prueba",
  OTRO: "Otro",
};

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/**
 * Gather upcoming/overdue expiries within `leadDays` (spec §4.9). Combines manual
 * Expiry entries with contract-end and trial-period dates derived from employees.
 */
export async function gatherAlerts(user: SessionUser, leadDays = 30): Promise<Alert[]> {
  const scope = localScope(user);
  const now = new Date();
  const horizon = new Date(now.getTime() + leadDays * 86400000);

  const [expiries, employees] = await Promise.all([
    prisma.expiry.findMany({
      where: { ...scope, resolved: false, dueDate: { lte: horizon } },
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
    prisma.employee.findMany({
      where: { ...scope, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, endDate: true, trialEndDate: true },
    }),
  ]);

  const alerts: Alert[] = [];

  for (const e of expiries) {
    alerts.push({
      employeeId: e.employeeId,
      employeeName: `${e.employee.lastName}, ${e.employee.firstName}`,
      kind: e.label || EXPIRY_LABELS[e.type] || e.type,
      dueDate: e.dueDate,
      daysLeft: daysBetween(e.dueDate, now),
      overdue: e.dueDate < now,
      expiryId: e.id,
    });
  }

  for (const emp of employees) {
    const name = `${emp.lastName}, ${emp.firstName}`;
    for (const [date, kind] of [
      [emp.endDate, "Fin de contrato temporal"] as const,
      [emp.trialEndDate, "Fin de período de prueba"] as const,
    ]) {
      if (date && date <= horizon) {
        alerts.push({
          employeeId: emp.id,
          employeeName: name,
          kind,
          dueDate: date,
          daysLeft: daysBetween(date, now),
          overdue: date < now,
        });
      }
    }
  }

  alerts.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return alerts;
}

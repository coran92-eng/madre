import "server-only";
import { prisma } from "./db";

// ── ISO week math (UTC, deterministic, DST-safe) ────────────────────────────

const MS_WEEK = 7 * 24 * 3600 * 1000;

export function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / MS_WEEK);
}

export function isoWeeksInYear(year: number): number {
  return isoWeek(new Date(Date.UTC(year, 11, 28)));
}

/** Monday (UTC midnight) of the given ISO week. */
export function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

export function isoWeekRange(year: number, week: number): { start: Date; end: Date } {
  const start = isoWeekMonday(year, week);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function weekLabel(year: number, week: number): string {
  const { start, end } = isoWeekRange(year, week);
  const s = `${start.getUTCDate()} ${MONTHS_ES[start.getUTCMonth()]}`;
  const e = `${end.getUTCDate()} ${MONTHS_ES[end.getUTCMonth()]}`;
  return `${s} – ${e}`;
}

export function approvedKey(localId: string, year: number, week: number): string {
  return `${localId}:${year}:${week}`;
}

// ── Domain queries ──────────────────────────────────────────────────────────

export async function getVacationYear(localId: string, year: number) {
  return prisma.vacationYear.findUnique({
    where: { localId_year: { localId, year } },
  });
}

export type WeekStatus =
  | { week: number; label: string; state: "available" }
  | { week: number; label: string; state: "blocked"; reason: string | null }
  | { week: number; label: string; state: "occupied"; by: string }
  | { week: number; label: string; state: "mine"; requestStatus: string };

/**
 * Per-week availability for the shared calendar. Enforces the ABSOLUTE
 * anti-overlap rule (spec §4.2): any week already held by a colleague — of any
 * role — is closed for everyone else.
 */
export async function weekAvailability(
  localId: string,
  year: number,
  forEmployeeId?: string
): Promise<WeekStatus[]> {
  const total = isoWeeksInYear(year);

  const [blocked, occupied] = await Promise.all([
    prisma.blockedWeek.findMany({ where: { localId, year } }),
    prisma.vacationWeek.findMany({
      where: { localId, year, approvedKey: { not: null } },
      include: {
        request: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
      },
    }),
  ]);

  // Weeks belonging to the current employee's PENDING requests (shown as "mine").
  const mine = forEmployeeId
    ? await prisma.vacationWeek.findMany({
        where: {
          localId,
          year,
          request: { employeeId: forEmployeeId, status: { in: ["PENDIENTE", "APROBADA"] } },
        },
        include: { request: { select: { status: true, employeeId: true } } },
      })
    : [];

  const blockedMap = new Map(blocked.map((b) => [b.week, b.reason] as const));
  const occupiedMap = new Map(
    occupied.map((w) => [w.week, `${w.request.employee.firstName} ${w.request.employee.lastName}`] as const)
  );
  const mineMap = new Map(mine.map((w) => [w.week, w.request.status] as const));

  const out: WeekStatus[] = [];
  for (let week = 1; week <= total; week++) {
    const label = weekLabel(year, week);
    const mineStatus = mineMap.get(week);
    if (mineStatus) {
      out.push({ week, label, state: "mine", requestStatus: mineStatus });
    } else if (occupiedMap.has(week)) {
      out.push({ week, label, state: "occupied", by: occupiedMap.get(week)! });
    } else if (blockedMap.has(week)) {
      out.push({ week, label, state: "blocked", reason: blockedMap.get(week) ?? null });
    } else {
      out.push({ week, label, state: "available" });
    }
  }
  return out;
}

export type CapacityReport = {
  year: number;
  activeEmployees: number;
  weeksPerEmployee: number;
  weeksRequired: number;
  totalWeeks: number;
  blockedWeeks: number;
  availableWeeks: number;
  ok: boolean;
  deficit: number; // >0 => no cabe
};

/**
 * Capacity validator (spec §4.2): does
 *   nº empleados × semanas/persona  ≤  (semanas del año − semanas bloqueadas)?
 * Called BEFORE opening requests so nobody is left without assignable holidays.
 */
export async function capacityCheck(
  localId: string,
  year: number
): Promise<CapacityReport> {
  const cfg = await getVacationYear(localId, year);
  const weeksPerEmployee = cfg?.weeksPerEmployee ?? 5;

  const [activeEmployees, blockedWeeks] = await Promise.all([
    prisma.employee.count({ where: { localId, deletedAt: null, status: "ACTIVO" } }),
    prisma.blockedWeek.count({ where: { localId, year } }),
  ]);

  const totalWeeks = isoWeeksInYear(year);
  const availableWeeks = totalWeeks - blockedWeeks;
  const weeksRequired = activeEmployees * weeksPerEmployee;
  const deficit = weeksRequired - availableWeeks;

  return {
    year,
    activeEmployees,
    weeksPerEmployee,
    weeksRequired,
    totalWeeks,
    blockedWeeks,
    availableWeeks,
    ok: deficit <= 0,
    deficit: Math.max(0, deficit),
  };
}

export type Balance = {
  entitlementDays: number; // derecho anual (días naturales)
  accruedDays: number; // devengado a fecha (2,5/mes)
  adjustmentDays: number; // bolsa: días a favor aprobados
  consumedDays: number; // disfrutados (semanas aprobadas × 7)
  pendingDays: number; // solicitado y pendiente de aprobar
  balanceDays: number; // saldo disponible
};

export async function employeeBalance(
  employeeId: string,
  year: number
): Promise<Balance> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Empleado no encontrado");

  const cfg = await getVacationYear(employee.localId, year);
  const entitlementDays = employee.vacationDaysOverride ?? cfg?.daysPerEmployee ?? 30;
  const accrualPerMonth = cfg?.accrualPerMonth ?? 2.5;

  // Devengo a fecha: meses transcurridos desde alta dentro del año.
  const now = new Date();
  const monthsThisYear =
    now.getUTCFullYear() > year
      ? 12
      : now.getUTCFullYear() < year
        ? 0
        : now.getUTCMonth() + 1;
  const startMonth =
    employee.startDate.getUTCFullYear() === year ? employee.startDate.getUTCMonth() : 0;
  const monthsWorked = Math.max(0, monthsThisYear - startMonth);
  const accruedDays = Math.min(entitlementDays, Math.round(monthsWorked * accrualPerMonth));

  const weeks = await prisma.vacationWeek.findMany({
    where: { localId: employee.localId, year, request: { employeeId } },
    include: { request: { select: { status: true } } },
  });
  const consumedDays = weeks.filter((w) => w.request.status === "APROBADA").length * 7;
  const pendingDays = weeks.filter((w) => w.request.status === "PENDIENTE").length * 7;

  const adjustments = await prisma.vacationAdjustment.aggregate({
    where: { employeeId, year, status: "APROBADA" },
    _sum: { days: true },
  });
  const adjustmentDays = adjustments._sum.days ?? 0;

  return {
    entitlementDays,
    accruedDays,
    adjustmentDays,
    consumedDays,
    pendingDays,
    balanceDays: entitlementDays + adjustmentDays - consumedDays,
  };
}

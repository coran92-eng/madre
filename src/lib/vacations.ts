import "server-only";
import { prisma } from "./db";

// Pure ISO week math lives in ./isoweek (no side effects, unit-tested).
export {
  isoWeek, isoWeeksInYear, isoWeekMonday, isoWeekRange, weekLabel, approvedKey,
} from "./isoweek";
import { isoWeekRange, isoWeeksInYear, weekLabel, approvedKey } from "./isoweek";

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

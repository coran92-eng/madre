import "server-only";
import { prisma } from "./db";

// Pure ISO week math lives in ./isoweek (no side effects, unit-tested).
export {
  isoWeek, isoWeeksInYear, isoWeekMonday, isoWeekRange, weekLabel, approvedKey,
  dateKey, dayApprovedKey, dayLabel, isoWeekDays,
} from "./isoweek";
import { isoWeeksInYear, weekLabel, isoWeekDays, dateKey, dayLabel } from "./isoweek";

// ── Domain queries ──────────────────────────────────────────────────────────

export async function getVacationYear(localId: string, year: number) {
  return prisma.vacationYear.findUnique({
    where: { localId_year: { localId, year } },
  });
}

export type DayState = "available" | "blocked" | "occupied" | "mine";

export type DayCell = {
  date: string; // yyyy-mm-dd
  label: string;
  state: DayState;
  by?: string; // occupied: nombre del compañero
  requestStatus?: string; // mine: PENDIENTE | APROBADA
  reason?: string | null; // blocked: motivo
};

export type WeekCell = {
  week: number;
  label: string;
  days: DayCell[]; // lunes a domingo
};

/**
 * Calendario día a día, agrupado por semana ISO, para el selector de
 * vacaciones. Un empleado puede reservar semanas completas (lunes-domingo) o
 * días sueltos — p. ej. cuando el derecho anual no encaja en semanas
 * completas (30 días = 4 semanas + 2 días sueltos), o para "días generados"
 * de la bolsa que se quieren coger de uno en uno.
 *
 * Regla anti-solapamiento ABSOLUTA (spec §4.2), ahora también día a día: un
 * día ya reservado — sea porque forma parte de una semana completa aprobada
 * de un compañero, o porque es un día suelto aprobado — no puede volver a
 * reservarse para nadie más.
 */
export async function calendarAvailability(
  localId: string,
  year: number,
  forEmployeeId?: string
): Promise<WeekCell[]> {
  const total = isoWeeksInYear(year);

  const [blocked, occupiedWeeks, occupiedDays, mineWeeks, mineDays] = await Promise.all([
    prisma.blockedWeek.findMany({ where: { localId, year } }),
    prisma.vacationWeek.findMany({
      where: { localId, year, approvedKey: { not: null } },
      include: { request: { include: { employee: { select: { firstName: true, lastName: true } } } } },
    }),
    prisma.vacationDay.findMany({
      where: { localId, year, approvedKey: { not: null } },
      include: { request: { include: { employee: { select: { firstName: true, lastName: true } } } } },
    }),
    forEmployeeId
      ? prisma.vacationWeek.findMany({
          where: { localId, year, request: { employeeId: forEmployeeId, status: { in: ["PENDIENTE", "APROBADA"] } } },
          include: { request: { select: { status: true } } },
        })
      : Promise.resolve([]),
    forEmployeeId
      ? prisma.vacationDay.findMany({
          where: { localId, year, request: { employeeId: forEmployeeId, status: { in: ["PENDIENTE", "APROBADA"] } } },
          include: { request: { select: { status: true } } },
        })
      : Promise.resolve([]),
  ]);

  const blockedMap = new Map(blocked.map((b) => [b.week, b.reason] as const));
  const dayOccupiedBy = new Map<string, string>();
  const dayMineStatus = new Map<string, string>();

  for (const w of occupiedWeeks) {
    const name = `${w.request.employee.firstName} ${w.request.employee.lastName}`;
    for (const d of isoWeekDays(year, w.week)) dayOccupiedBy.set(dateKey(d), name);
  }
  for (const d of occupiedDays) {
    dayOccupiedBy.set(dateKey(d.date), `${d.request.employee.firstName} ${d.request.employee.lastName}`);
  }
  for (const w of mineWeeks) {
    for (const d of isoWeekDays(year, w.week)) dayMineStatus.set(dateKey(d), w.request.status);
  }
  for (const d of mineDays) {
    dayMineStatus.set(dateKey(d.date), d.request.status);
  }

  const out: WeekCell[] = [];
  for (let week = 1; week <= total; week++) {
    const days: DayCell[] = isoWeekDays(year, week).map((d) => {
      const key = dateKey(d);
      const label = dayLabel(d);
      const mineStatus = dayMineStatus.get(key);
      if (mineStatus) return { date: key, label, state: "mine", requestStatus: mineStatus };
      const by = dayOccupiedBy.get(key);
      if (by) return { date: key, label, state: "occupied", by };
      if (blockedMap.has(week)) return { date: key, label, state: "blocked", reason: blockedMap.get(week) ?? null };
      return { date: key, label, state: "available" };
    });
    out.push({ week, label: weekLabel(year, week), days });
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

  const [weeks, days] = await Promise.all([
    prisma.vacationWeek.findMany({
      where: { localId: employee.localId, year, request: { employeeId } },
      include: { request: { select: { status: true } } },
    }),
    prisma.vacationDay.findMany({
      where: { localId: employee.localId, year, request: { employeeId } },
      include: { request: { select: { status: true } } },
    }),
  ]);
  const consumedDays =
    weeks.filter((w) => w.request.status === "APROBADA").length * 7 +
    days.filter((d) => d.request.status === "APROBADA").length;
  const pendingDays =
    weeks.filter((w) => w.request.status === "PENDIENTE").length * 7 +
    days.filter((d) => d.request.status === "PENDIENTE").length;

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

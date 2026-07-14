// Pure ISO week math (UTC, deterministic, DST-safe). No side effects — unit-tested.

const MS_WEEK = 7 * 24 * 3600 * 1000;

export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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

/** yyyy-mm-dd (UTC) — clave estable para un día natural. */
export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dayApprovedKey(localId: string, date: Date): string {
  return `${localId}:${dateKey(date)}`;
}

const WEEKDAYS_ES = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export function dayLabel(date: Date): string {
  return `${WEEKDAYS_ES[(date.getUTCDay() + 6) % 7]} ${date.getUTCDate()} ${MONTHS_ES[date.getUTCMonth()]}`;
}

/** Todas las fechas (UTC medianoche) de una semana ISO, lunes a domingo. */
export function isoWeekDays(year: number, week: number): Date[] {
  const monday = isoWeekMonday(year, week);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d;
  });
}

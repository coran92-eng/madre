// Time-clock helpers (UTC-based, deterministic).

export function monthRange(year: number, month1: number): { start: Date; end: Date } {
  // month1 = 1..12
  const start = new Date(Date.UTC(year, month1 - 1, 1));
  const end = new Date(Date.UTC(year, month1, 1)); // exclusive
  return { start, end };
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(key: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (!key || !/^\d{4}-\d{2}$/.test(key)) {
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

export function shiftMonthKey(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Minutes between clockIn and clockOut (0 if still open). */
export function entryMinutes(clockIn: Date, clockOut: Date | null): number {
  if (!clockOut) return 0;
  return Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000));
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export function monthLabel(year: number, month1: number): string {
  return `${MONTHS_ES[month1 - 1]} ${year}`;
}

export function fmtTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

export function fmtDateTime(d: Date): string {
  return d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" });
}

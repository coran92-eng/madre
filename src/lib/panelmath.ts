// Pure helpers for the director panel (no side effects → unit-tested).

/** Net sales from a cash close: counted cash minus float, plus card and other. */
export function netSales(c: { cashCounted: number; openingFloat: number; cardTotal: number; otherTotal: number }): number {
  return Math.max(0, c.cashCounted - c.openingFloat) + c.cardTotal + c.otherTotal;
}

/** Sales per worked hour (productivity proxy). 0 if no hours. */
export function salesPerHour(sales: number, workedMinutes: number): number {
  if (workedMinutes <= 0) return 0;
  return sales / (workedMinutes / 60);
}

/** Inclusive count of whole days a [aStart,aEnd] range overlaps [mStart,mEnd]. */
export function overlapDays(aStart: Date, aEnd: Date, mStart: Date, mEnd: Date): number {
  const start = Math.max(aStart.getTime(), mStart.getTime());
  const end = Math.min(aEnd.getTime(), mEnd.getTime());
  if (end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

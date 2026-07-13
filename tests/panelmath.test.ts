import { describe, it, expect } from "vitest";
import { netSales, salesPerHour, overlapDays, round2 } from "@/lib/panelmath";

describe("panel de dirección · math", () => {
  it("net sales = counted cash − float + card + other", () => {
    expect(netSales({ cashCounted: 842.5, openingFloat: 150, cardTotal: 1210, otherTotal: 0 })).toBe(1902.5);
    // float mayor que el efectivo contado no da negativo
    expect(netSales({ cashCounted: 100, openingFloat: 150, cardTotal: 50, otherTotal: 0 })).toBe(50);
  });

  it("sales per hour (0 si no hay horas)", () => {
    expect(salesPerHour(600, 300)).toBe(120); // 5h → 120 €/h
    expect(salesPerHour(600, 0)).toBe(0);
  });

  it("overlap days inclusive con el mes", () => {
    const mStart = new Date(Date.UTC(2026, 6, 1));
    const mEnd = new Date(Date.UTC(2026, 6, 31));
    // ausencia 30 jun → 2 jul: solo 1 y 2 jul caen en el mes
    expect(overlapDays(new Date(Date.UTC(2026, 5, 30)), new Date(Date.UTC(2026, 6, 2)), mStart, mEnd)).toBe(2);
    // fuera del mes
    expect(overlapDays(new Date(Date.UTC(2026, 7, 1)), new Date(Date.UTC(2026, 7, 3)), mStart, mEnd)).toBe(0);
    // un solo día
    expect(overlapDays(new Date(Date.UTC(2026, 6, 15)), new Date(Date.UTC(2026, 6, 15)), mStart, mEnd)).toBe(1);
  });

  it("round2", () => {
    expect(round2(30.005)).toBe(30.01);
    expect(round2(90 / 3)).toBe(30);
  });
});

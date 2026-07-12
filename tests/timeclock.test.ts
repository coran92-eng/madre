import { describe, it, expect } from "vitest";
import { monthRange, parseMonthKey, shiftMonthKey, entryMinutes, formatMinutes } from "@/lib/timeclock";

describe("timeclock helpers", () => {
  it("builds an exclusive month range", () => {
    const { start, end } = monthRange(2026, 7);
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("parses month keys and defaults sanely", () => {
    expect(parseMonthKey("2026-03")).toEqual({ year: 2026, month: 3 });
    const now = parseMonthKey(undefined);
    expect(now.month).toBeGreaterThanOrEqual(1);
    expect(now.month).toBeLessThanOrEqual(12);
  });

  it("shifts month keys across year boundaries", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
  });

  it("computes worked minutes (0 while open)", () => {
    const inT = new Date(Date.UTC(2026, 0, 10, 9, 0));
    const outT = new Date(Date.UTC(2026, 0, 10, 17, 30));
    expect(entryMinutes(inT, outT)).toBe(510);
    expect(entryMinutes(inT, null)).toBe(0);
  });

  it("formats minutes as h/m", () => {
    expect(formatMinutes(510)).toBe("8h 30m");
    expect(formatMinutes(5)).toBe("0h 05m");
  });
});

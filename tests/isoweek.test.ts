import { describe, it, expect } from "vitest";
import {
  isoWeek, isoWeeksInYear, isoWeekMonday, isoWeekRange, weekLabel, approvedKey,
  dateKey, dayApprovedKey, dayLabel, isoWeekDays,
} from "@/lib/isoweek";

describe("ISO week math", () => {
  it("computes the ISO week number", () => {
    expect(isoWeek(new Date(Date.UTC(2026, 0, 1)))).toBe(1); // 1 Jan 2026 is week 1
    expect(isoWeek(new Date(Date.UTC(2026, 6, 20)))).toBe(30); // 20 Jul 2026 → week 30
  });

  it("knows years with 52 or 53 weeks", () => {
    expect(isoWeeksInYear(2026)).toBe(53); // 2026 is a 53-week ISO year
    expect(isoWeeksInYear(2025)).toBe(52);
  });

  it("week 1 Monday is on or after the year start", () => {
    const monday = isoWeekMonday(2026, 1);
    expect(monday.getUTCDay()).toBe(1); // Monday
    expect(isoWeek(monday)).toBe(1);
  });

  it("range spans Monday..Sunday (7 days)", () => {
    const { start, end } = isoWeekRange(2026, 30);
    expect(start.getUTCDay()).toBe(1);
    expect(end.getUTCDay()).toBe(0);
    expect((end.getTime() - start.getTime()) / 86400000).toBe(6);
  });

  it("round-trips every week of a 53-week year", () => {
    for (let w = 1; w <= isoWeeksInYear(2026); w++) {
      expect(isoWeek(isoWeekMonday(2026, w))).toBe(w);
    }
  });

  it("formats labels and keys", () => {
    expect(weekLabel(2026, 30)).toMatch(/\d+ \w+ – \d+ \w+/);
    expect(approvedKey("cdm", 2026, 30)).toBe("cdm:2026:30");
  });

  it("computes day-level keys and labels", () => {
    const d = new Date(Date.UTC(2026, 6, 20)); // Monday 20 Jul 2026
    expect(dateKey(d)).toBe("2026-07-20");
    expect(dayApprovedKey("cdm", d)).toBe("cdm:2026-07-20");
    expect(dayLabel(d)).toMatch(/^lun \d+ \w+$/);
  });

  it("lists the 7 dates of an ISO week, Monday first", () => {
    const days = isoWeekDays(2026, 30);
    expect(days).toHaveLength(7);
    expect(days[0].getUTCDay()).toBe(1); // Monday
    expect(days[6].getUTCDay()).toBe(0); // Sunday
    for (let i = 1; i < 7; i++) {
      expect(days[i].getTime() - days[i - 1].getTime()).toBe(86400000);
    }
  });
});

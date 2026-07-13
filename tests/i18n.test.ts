import { describe, it, expect } from "vitest";
import { t, normalizeLang } from "@/lib/i18n";

describe("i18n", () => {
  it("translates known keys per language", () => {
    expect(t("es", "nav.vacations")).toBe("Vacaciones");
    expect(t("ca", "nav.vacations")).toBe("Vacances");
  });

  it("falls back to Spanish, then to the key", () => {
    expect(t("ca", "nav.dashboard")).toBe("Inici");
    expect(t("es", "does.not.exist")).toBe("does.not.exist");
  });

  it("normalizes languages safely", () => {
    expect(normalizeLang("ca")).toBe("ca");
    expect(normalizeLang("en")).toBe("es");
    expect(normalizeLang(undefined)).toBe("es");
  });
});

import { describe, expect, it } from "vitest";
import { formatTime, inputTime, manilaNow, openState } from "../src/lib/hours";
import { normalizeHours, shopSchema } from "../src/lib/shop-form";
import { toWeekHours } from "../src/lib/places.server";
import { credentialsSchema, safeRedirect } from "../src/lib/auth";

const monday = (time: string) => new Date(`2026-09-21T${time}:00+08:00`);

describe("opening hours", () => {
  it("uses Manila time, including midnight", () => {
    expect(manilaNow(monday("00:00"))).toEqual({ dayIndex: 1, minutes: 0 });
  });
  it("includes opening time and excludes closing time", () => {
    const hours = { mon: ["08:00", "20:00"] as [string, string] };
    expect(openState(hours, monday("07:59")).open).toBe(false);
    expect(openState(hours, monday("08:00")).open).toBe(true);
    expect(openState(hours, monday("20:00")).open).toBe(false);
  });
  it.each(["03:00", "27:00"])("supports overnight closing written as %s", (close) => {
    expect(openState({ sun: ["16:00", close] }, monday("02:59")).open).toBe(true);
    expect(openState({ sun: ["16:00", close] }, monday("03:00")).open).toBe(false);
    expect(openState({ mon: ["16:00", close] }, monday("23:00")).open).toBe(true);
  });
  it("handles 24-hour schedules", () => {
    expect(openState({ mon: ["00:00", "00:00"] }, monday("23:59")).open).toBe(true);
    expect(formatTime("27:00")).toBe("3:00 AM");
    expect(inputTime("27:00")).toBe("03:00");
    expect(inputTime("24:00")).toBe("00:00");
  });
  it("normalizes form times without silently accepting empty fields", () => {
    expect(normalizeHours({ mon: ["16:00", "03:00"] }).mon).toEqual(["16:00", "27:00"]);
    expect(normalizeHours({ mon: ["08:00", "08:00"] }).mon).toEqual(["08:00", "32:00"]);
    expect(() => normalizeHours({ mon: ["", "20:00"] })).toThrow("Monday");
    expect(() => normalizeHours({ mon: ["08:00", "40:00"] })).toThrow("24 hours");
    expect(normalizeHours({}).mon).toBeNull();
  });
  it("imports Google's always-open period as all seven days", () => {
    const hours = toWeekHours({
      id: "test",
      regularOpeningHours: { periods: [{ open: { day: 0, hour: 0 } }] },
    });
    expect(Object.values(hours)).toHaveLength(7);
    expect(Object.values(hours).every((value) => value?.[1] === "24:00")).toBe(true);
  });
});

describe("form and redirect validation", () => {
  const shop = {
    name: "Cafe Test",
    city: "Iligan City",
    area: "Tibanga",
    address: "Test Street",
    blurb: "",
    lat: "8.2",
    lng: "124.2",
    price_level: "4",
  };
  it("allows imported premium price levels and rejects blank coordinates", () => {
    expect(shopSchema.parse(shop).price_level).toBe(4);
    expect(shopSchema.safeParse({ ...shop, lat: "" }).success).toBe(false);
    expect(shopSchema.safeParse({ ...shop, lat: "   " }).success).toBe(false);
    expect(shopSchema.safeParse({ ...shop, lng: "999" }).success).toBe(false);
  });
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", null])(
    "rejects external redirect %s",
    (path) => {
      expect(safeRedirect(path)).toBe("/");
    },
  );
  it("preserves a local destination after login", () => {
    expect(safeRedirect("/submit?from=home")).toBe("/submit?from=home");
  });
  it("does not apply a new-password policy to existing accounts", () => {
    expect(
      credentialsSchema("signin").safeParse({ email: "test@example.com", password: "short" })
        .success,
    ).toBe(true);
    expect(
      credentialsSchema("signup").safeParse({ email: "test@example.com", password: "short" })
        .success,
    ).toBe(false);
  });
});

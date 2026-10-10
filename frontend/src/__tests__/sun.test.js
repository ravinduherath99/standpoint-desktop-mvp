import { describe, expect, it } from "vitest";
import {
  DEFAULT_COORDS,
  DEFAULT_TIME_ZONE,
  describeLight,
  getSunTimes,
  overlapMinutes,
} from "../lib/sun";

describe("sun helpers", () => {
  it("exports the fixed Carlton Gardens calculation location", () => {
    expect(DEFAULT_COORDS).toEqual({
      name: "Carlton Gardens",
      latitude: -37.8064,
      longitude: 144.9717,
    });
    expect(DEFAULT_TIME_ZONE).toBe("Australia/Melbourne");
  });

  it.each(["", "2026-02-29", "2026-04-31", "not-a-date"])(
    "handles invalid date %s safely",
    (date) => expect(getSunTimes(date)).toBeNull()
  );

  it("matches representative independent Melbourne reference values within five minutes", () => {
    // Reference comparison: timeanddate.com Melbourne sun tables, checked during implementation.
    // 2026-06-21: sunrise 07:35, noon 12:21, sunset 17:08.
    // 2026-10-24: sunrise 06:23, noon 13:04, sunset 19:45/19:46.
    const winter = getSunTimes("2026-06-21");
    const spring = getSunTimes("2026-10-24");

    expect(Math.abs(winter.sunrise - 455)).toBeLessThanOrEqual(5);
    expect(Math.abs(winter.solarNoon - 741)).toBeLessThanOrEqual(5);
    expect(Math.abs(winter.sunset - 1028)).toBeLessThanOrEqual(5);
    expect(Math.abs(spring.sunrise - 383)).toBeLessThanOrEqual(5);
    expect(Math.abs(spring.solarNoon - 784)).toBeLessThanOrEqual(5);
    expect(Math.abs(spring.sunset - 1185)).toBeLessThanOrEqual(5);
  });

  it("uses Melbourne standard time and daylight saving via Intl", () => {
    expect(getSunTimes("2026-06-21").utcOffsetMinutes).toBe(600);
    expect(getSunTimes("2026-10-24").utcOffsetMinutes).toBe(660);
    expect(getSunTimes("2026-04-04").utcOffsetMinutes).toBe(660);
    expect(getSunTimes("2026-04-06").utcOffsetMinutes).toBe(600);
    expect(getSunTimes("2026-10-03").utcOffsetMinutes).toBe(600);
    expect(getSunTimes("2026-10-05").utcOffsetMinutes).toBe(660);
  });

  it("shows longer daylight in Melbourne summer than winter", () => {
    const winter = getSunTimes("2026-06-21");
    const summer = getSunTimes("2026-12-21");
    expect(summer.sunset - summer.sunrise).toBeGreaterThan(winter.sunset - winter.sunrise);
  });

  it("returns ordered golden and blue intervals around daylight", () => {
    const times = getSunTimes("2026-10-24");
    expect(times.blue.morning.end).toBe(times.golden.morning.start);
    expect(times.golden.morning.end).toBe(times.day.start);
    expect(times.day.end).toBe(times.golden.evening.start);
    expect(times.golden.evening.end).toBe(times.blue.evening.start);
  });

  it("calculates interval overlap deterministically", () => {
    expect(overlapMinutes({ start: 60, end: 120 }, { start: 90, end: 150 })).toBe(30);
    expect(overlapMinutes({ start: 60, end: 90 }, { start: 90, end: 120 })).toBe(0);
    expect(overlapMinutes(null, { start: 90, end: 120 })).toBe(0);
    expect(overlapMinutes({ start: 120, end: 60 }, { start: 90, end: 150 })).toBe(0);
  });

  it("describes representative golden, day and night windows", () => {
    expect(describeLight("2026-10-24", "06:10", "60 minutes").tone).toBe("golden");
    expect(describeLight("2026-10-24", "12:00", "60 minutes").tone).toBe("day");
    expect(describeLight("2026-10-24", "23:00", "60 minutes").tone).toBe("night");
  });

  it("reports blue-hour overlap even when an available shoot duration spans other light", () => {
    const result = describeLight("2026-10-24", "05:58", "60 minutes");
    expect(result.overlaps.blue).toBeGreaterThan(0);
  });

  it("uses the following date for a shoot crossing midnight", () => {
    const result = describeLight("2026-10-24", "23:30", "90 minutes");
    expect(result.window).toEqual({ start: 1410, end: 1500 });
    expect(result.overlaps.night).toBe(90);
    expect(result.tone).toBe("night");
  });

  it("handles invalid light descriptions safely", () => {
    expect(describeLight("invalid", "12:00", "60 minutes")).toBeNull();
    expect(describeLight("2026-10-24", "25:00", "60 minutes")).toBeNull();
    expect(describeLight("2026-10-24", "12:00", "45 minutes")).toBeNull();
  });
});
import { describe, expect, it } from "vitest";
import {
  durationMinutes,
  formatDate,
  formatMinutes,
  formatShootWindow,
  formatTime,
  parseDateParts,
  parseTime,
  shootWindow,
  toTimeValue,
} from "../lib/format";

describe("format helpers", () => {
  it("formats a real calendar date with weekday and year", () => {
    expect(formatDate("2026-10-24")).toBe("Sat 24 Oct 2026");
  });

  it.each(["", "2026-02-29", "2026-13-01", "2026-04-31", "24-10-2026", null])(
    "rejects invalid calendar date %s",
    (value) => {
      expect(parseDateParts(value)).toBeNull();
      expect(formatDate(value)).toBe("");
    }
  );

  it("accepts a real leap day", () => {
    expect(formatDate("2028-02-29")).toBe("Wed 29 Feb 2028");
  });

  it("parses strict 24-hour time values", () => {
    expect(parseTime("17:30")).toBe(1050);
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("23:59")).toBe(1439);
  });

  it.each(["24:00", "7:30", "17:60", "17:3", "not-a-time", ""])(
    "rejects invalid time %s",
    (value) => expect(parseTime(value)).toBeNull()
  );

  it("formats minute and HH:MM values", () => {
    expect(formatMinutes(1050)).toBe("5:30 pm");
    expect(formatMinutes(0)).toBe("12:00 am");
    expect(formatTime("17:30")).toBe("5:30 pm");
    expect(formatTime("24:00")).toBe("");
  });

  it("converts only same-day minute values to form time strings", () => {
    expect(toTimeValue(1050)).toBe("17:30");
    expect(toTimeValue(1439)).toBe("23:59");
    expect(toTimeValue(1440)).toBe("");
  });

  it("supports every existing duration value", () => {
    expect(durationMinutes("60 minutes")).toBe(60);
    expect(durationMinutes("90 minutes")).toBe(90);
    expect(durationMinutes("2 hours")).toBe(120);
    expect(durationMinutes("3 hours")).toBe(180);
    expect(durationMinutes("Select duration")).toBeNull();
  });

  it("returns normal shoot windows", () => {
    expect(shootWindow("17:30", "90 minutes")).toEqual({ start: 1050, end: 1140 });
  });

  it("keeps midnight-crossing ends above 1440 and labels the next day", () => {
    expect(shootWindow("23:30", "90 minutes")).toEqual({ start: 1410, end: 1500 });
    expect(formatMinutes(1500)).toBe("1:00 am (+1 day)");
    expect(toTimeValue(1500)).toBe("");
  });

  it("returns null for invalid shoot windows", () => {
    expect(shootWindow("24:00", "90 minutes")).toBeNull();
    expect(shootWindow("17:30", "45 minutes")).toBeNull();
  });

  it("formats complete shoot windows with a calculated end time", () => {
    expect(formatShootWindow("14:00", "2 hours")).toBe("2:00 pm–4:00 pm");
  });

  it("makes a cross-midnight shoot window explicit", () => {
    expect(formatShootWindow("23:30", "90 minutes")).toBe("11:30 pm–1:00 am (+1 day)");
  });

  it.each([
    ["", "2 hours"],
    ["24:00", "2 hours"],
    ["14:00", ""],
    ["14:00", "Select duration"],
    ["14:00", "45 minutes"],
  ])("returns an empty window for start %s and duration %s", (startTime, duration) => {
    expect(formatShootWindow(startTime, duration)).toBe("");
  });
});
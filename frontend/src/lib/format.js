const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DURATIONS = Object.freeze({
  "60 minutes": 60,
  "90 minutes": 90,
  "2 hours": 120,
  "3 hours": 180,
});

/** Strictly parse a real Gregorian YYYY-MM-DD calendar date. */
export function parseDateParts(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return { year, month, day };
}

/** Format YYYY-MM-DD as "Sat 24 Oct 2026", or return an empty string. */
export function formatDate(value) {
  const parts = parseDateParts(value);
  if (!parts) return "";

  const date = new Date(Date.UTC(0, parts.month - 1, parts.day));
  date.setUTCFullYear(parts.year);
  return `${WEEKDAYS[date.getUTCDay()]} ${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

/** Parse strict 24-hour HH:MM text to minutes since midnight. */
export function parseTime(value) {
  if (typeof value !== "string") return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Format elapsed minutes as a 12-hour time.
 * Values beyond midnight retain an explicit day offset, e.g. "1:00 am (+1 day)".
 */
export function formatMinutes(value) {
  if (!Number.isInteger(value) || value < 0) return "";
  const dayOffset = Math.floor(value / 1440);
  const clockMinutes = value % 1440;
  const hour24 = Math.floor(clockMinutes / 60);
  const minute = clockMinutes % 60;
  const suffix = hour24 < 12 ? "am" : "pm";
  const hour12 = hour24 % 12 || 12;
  const time = `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
  if (dayOffset === 0) return time;
  return `${time} (+${dayOffset} ${dayOffset === 1 ? "day" : "days"})`;
}

/** Format strict HH:MM text as a 12-hour time. */
export function formatTime(value) {
  const minutes = parseTime(value);
  return minutes === null ? "" : formatMinutes(minutes);
}

/** Convert same-day clock minutes to HH:MM; next-day values return an empty string. */
export function toTimeValue(value) {
  if (!Number.isInteger(value) || value < 0 || value >= 1440) return "";
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Return the minute duration for one of the planner's existing duration values. */
export function durationMinutes(value) {
  return Object.prototype.hasOwnProperty.call(DURATIONS, value) ? DURATIONS[value] : null;
}

/**
 * Return an elapsed-minute shoot window.
 * A shoot crossing midnight has an end above 1440 so the next date is explicit.
 */
export function shootWindow(startTime, duration) {
  const start = parseTime(startTime);
  const length = durationMinutes(duration);
  if (start === null || length === null) return null;
  return { start, end: start + length };
}

/** Format a complete shoot window as a readable start–end range. */
export function formatShootWindow(startTime, duration) {
  const window = shootWindow(startTime, duration);
  return window ? `${formatMinutes(window.start)}–${formatMinutes(window.end)}` : "";
}
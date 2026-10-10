import { parseDateParts, shootWindow } from "./format.js";

export const DEFAULT_COORDS = Object.freeze({
  name: "Carlton Gardens",
  latitude: -37.8064,
  longitude: 144.9717,
});

export const DEFAULT_TIME_ZONE = "Australia/Melbourne";

const SUNRISE_ELEVATION = -0.833;
const GOLDEN_HIGH_ELEVATION = 6;
const GOLDEN_LOW_ELEVATION = -4;
const BLUE_LOW_ELEVATION = -6;

const toRadians = (degrees) => (degrees * Math.PI) / 180;
const toDegrees = (radians) => (radians * 180) / Math.PI;

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function dayOfYear({ year, month, day }) {
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86400000) + 1;
}

function solarTerms(parts) {
  const days = isLeapYear(parts.year) ? 366 : 365;
  const gamma = (2 * Math.PI / days) * (dayOfYear(parts) - 1);
  const equationOfTime = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma)
  );
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  return { equationOfTime, declination };
}

function timeZoneOffsetMinutes(parts, timeZone) {
  try {
    const instant = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const values = Object.fromEntries(
      formatter.formatToParts(instant).map((part) => [part.type, part.value])
    );
    const localAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
    return Math.round((localAsUtc - instant.getTime()) / 60000);
  } catch {
    return null;
  }
}

function hourAngleDegrees(latitude, declination, elevation) {
  const latitudeRadians = toRadians(latitude);
  const numerator = Math.sin(toRadians(elevation)) -
    Math.sin(latitudeRadians) * Math.sin(declination);
  const denominator = Math.cos(latitudeRadians) * Math.cos(declination);
  const cosine = numerator / denominator;
  if (!Number.isFinite(cosine) || cosine < -1 || cosine > 1) return null;
  return toDegrees(Math.acos(cosine));
}

function crossingMinutes(solarNoon, latitude, declination, elevation, morning) {
  const hourAngle = hourAngleDegrees(latitude, declination, elevation);
  if (hourAngle === null) return null;
  const value = solarNoon + (morning ? -1 : 1) * hourAngle * 4;
  return Number.isFinite(value) ? Math.round(value) : null;
}

function interval(start, end) {
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? { start, end }
    : null;
}

/** Calculate approximate Carlton Gardens solar events in local Melbourne minutes. */
export function getSunTimes(date) {
  const parts = parseDateParts(date);
  if (!parts) return null;

  const offsetMinutes = timeZoneOffsetMinutes(parts, DEFAULT_TIME_ZONE);
  if (offsetMinutes === null) return null;

  const { equationOfTime, declination } = solarTerms(parts);
  const solarNoonValue = 720 - 4 * DEFAULT_COORDS.longitude - equationOfTime + offsetMinutes;
  const solarNoon = Math.round(solarNoonValue);

  const morningBlueStart = crossingMinutes(
    solarNoonValue, DEFAULT_COORDS.latitude, declination, BLUE_LOW_ELEVATION, true
  );
  const morningGoldenStart = crossingMinutes(
    solarNoonValue, DEFAULT_COORDS.latitude, declination, GOLDEN_LOW_ELEVATION, true
  );
  const morningGoldenEnd = crossingMinutes(
    solarNoonValue, DEFAULT_COORDS.latitude, declination, GOLDEN_HIGH_ELEVATION, true
  );
  const eveningGoldenStart = crossingMinutes(
    solarNoonValue, DEFAULT_COORDS.latitude, declination, GOLDEN_HIGH_ELEVATION, false
  );
  const eveningGoldenEnd = crossingMinutes(
    solarNoonValue, DEFAULT_COORDS.latitude, declination, GOLDEN_LOW_ELEVATION, false
  );
  const eveningBlueEnd = crossingMinutes(
    solarNoonValue, DEFAULT_COORDS.latitude, declination, BLUE_LOW_ELEVATION, false
  );

  const sunrise = crossingMinutes(
    solarNoonValue, DEFAULT_COORDS.latitude, declination, SUNRISE_ELEVATION, true
  );
  const sunset = crossingMinutes(
    solarNoonValue, DEFAULT_COORDS.latitude, declination, SUNRISE_ELEVATION, false
  );

  const golden = {
    morning: interval(morningGoldenStart, morningGoldenEnd),
    evening: interval(eveningGoldenStart, eveningGoldenEnd),
  };
  const blue = {
    morning: interval(morningBlueStart, morningGoldenStart),
    evening: interval(eveningGoldenEnd, eveningBlueEnd),
  };
  const day = interval(morningGoldenEnd, eveningGoldenStart);

  if (
    !Number.isFinite(sunrise) ||
    !Number.isFinite(sunset) ||
    !Number.isFinite(solarNoon) ||
    !golden.morning ||
    !golden.evening ||
    !blue.morning ||
    !blue.evening ||
    !day
  ) {
    return null;
  }

  return {
    date,
    location: DEFAULT_COORDS.name,
    coordinates: DEFAULT_COORDS,
    timeZone: DEFAULT_TIME_ZONE,
    utcOffsetMinutes: offsetMinutes,
    sunrise,
    sunset,
    solarNoon,
    golden,
    blue,
    day,
  };
}

/** Return the shared duration of two half-open minute intervals. */
export function overlapMinutes(first, second) {
  if (!first || !second) return 0;
  const values = [first.start, first.end, second.start, second.end];
  if (!values.every(Number.isFinite) || first.end <= first.start || second.end <= second.start) {
    return 0;
  }
  return Math.max(0, Math.min(first.end, second.end) - Math.max(first.start, second.start));
}

function addDays(date, count) {
  const parts = parseDateParts(date);
  if (!parts) return "";
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + count));
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function shiftedInterval(value, shift) {
  return value ? { start: value.start + shift, end: value.end + shift } : null;
}

function toneIntervals(times, shift = 0) {
  if (!times) return null;
  return {
    golden: [
      shiftedInterval(times.golden.morning, shift),
      shiftedInterval(times.golden.evening, shift),
    ],
    blue: [
      shiftedInterval(times.blue.morning, shift),
      shiftedInterval(times.blue.evening, shift),
    ],
    day: [shiftedInterval(times.day, shift)],
    night: [
      { start: shift, end: times.blue.morning.start + shift },
      { start: times.blue.evening.end + shift, end: 1440 + shift },
    ],
  };
}

/**
 * Describe a planner shoot window using fixed Carlton Gardens light calculations.
 * Cross-midnight windows include the following date's events rather than wrapping.
 */
export function describeLight(date, startTime, duration) {
  const window = shootWindow(startTime, duration);
  const today = getSunTimes(date);
  if (!window || !today) return null;

  const intervals = toneIntervals(today);
  if (window.end > 1440) {
    const tomorrow = getSunTimes(addDays(date, 1));
    const nextIntervals = toneIntervals(tomorrow, 1440);
    if (!nextIntervals) return null;
    for (const tone of Object.keys(intervals)) intervals[tone].push(...nextIntervals[tone]);
  }

  const overlaps = {};
  for (const [tone, values] of Object.entries(intervals)) {
    overlaps[tone] = values.reduce(
      (total, value) => total + overlapMinutes(window, value),
      0
    );
  }

  const priority = ["golden", "blue", "day", "night"];
  const tone = priority.reduce((best, candidate) =>
    overlaps[candidate] > overlaps[best] ? candidate : best
  );

  return {
    location: DEFAULT_COORDS.name,
    date,
    window,
    overlaps,
    tone,
  };
}
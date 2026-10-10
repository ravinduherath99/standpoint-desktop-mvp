/** Backward-compatible adapters. New code should import from ../lib modules. */
import { parseTime, toTimeValue } from "../lib/format.js";
import { getSunTimes } from "../lib/sun.js";

export function hhmmToMinutes(value) {
  return parseTime(value) ?? 0;
}

export function getLightPhases(date) {
  const times = getSunTimes(date);
  if (!times) return null;
  return {
    sunrise: toTimeValue(times.sunrise),
    goldenStart: toTimeValue(times.golden.morning.start),
    goldenEnd: toTimeValue(times.golden.morning.end),
    blueStart: toTimeValue(times.golden.evening.start),
    solarNoon: toTimeValue(times.solarNoon),
    sunset: toTimeValue(times.sunset),
    blueEnd: toTimeValue(times.blue.evening.end),
  };
}

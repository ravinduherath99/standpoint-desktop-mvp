import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Sunrise, Sunset } from "lucide-react";
import {
  durationMinutes,
  formatDate,
  formatMinutes,
  parseDateParts,
  parseTime,
  shootWindow,
  toTimeValue,
} from "../lib/format";
import {
  DEFAULT_COORDS,
  DEFAULT_TIME_ZONE,
  describeLight,
  getSunTimes,
} from "../lib/sun";

const CHART_HEIGHT = 132;
const MIN_CHART_WIDTH = 260;
const HORIZONTAL_PADDING = 16;
const HORIZON_Y = 96;
const ARC_HEIGHT = 66;
const ARC_TOP = HORIZON_Y - ARC_HEIGHT;
const CHART_TOP = 12;
const CHART_BOTTOM = 118;
const CHART_BACKGROUND_HEIGHT = CHART_BOTTOM - CHART_TOP;
const NARROW_WIDTH = 420;
const SELECTION_INTERVAL = 15;
const SHORTLY_BEFORE_GOLDEN_MINUTES = 60;
const INCOMPLETE_INSIGHT = "Tap the timeline or pick a start time to see your shoot against the light.";

function todayInMelbourne() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function buildDomain(times) {
  return {
    start: clamp(Math.floor((times.blue.morning.start - 45) / 60) * 60, 0, 1380),
    end: clamp(Math.ceil((times.blue.evening.end + 45) / 60) * 60, 60, 1440),
  };
}

function snapMinutes(value) {
  return clamp(
    Math.round(value / SELECTION_INTERVAL) * SELECTION_INTERVAL,
    0,
    1440 - SELECTION_INTERVAL
  );
}

function intervalText(interval) {
  return `${formatMinutes(interval.start)}–${formatMinutes(interval.end)}`;
}

function buildTicks(start, end, stepHours) {
  const ticks = [];
  const step = stepHours * 60;
  for (let minute = start; minute <= end; minute += step) ticks.push(minute);
  return ticks;
}

function arcY(minute, sunrise, sunset) {
  const progress = clamp((minute - sunrise) / (sunset - sunrise), 0, 1);
  return HORIZON_Y - Math.sin(progress * Math.PI) * (HORIZON_Y - ARC_TOP);
}

function goldenShortcut(interval, duration) {
  const length = durationMinutes(duration) ?? 0;
  const first = Math.ceil(interval.start / SELECTION_INTERVAL) * SELECTION_INTERVAL;
  const last = clamp(
    Math.floor(interval.end / SELECTION_INTERVAL) * SELECTION_INTERVAL,
    0,
    1440 - SELECTION_INTERVAL
  );
  const latestFullFit = Math.floor(
    (interval.end - length) / SELECTION_INTERVAL
  ) * SELECTION_INTERVAL;
  if (length > 0 && first <= latestFullFit) return first;
  return clamp(Math.min(first, last), 0, 1440 - SELECTION_INTERVAL);
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

function includesMinute(interval, minute) {
  return minute >= interval.start && minute < interval.end;
}

function conditionInsight(date, shoot, light, times) {
  if (!shoot || !light || !times) return INCOMPLETE_INSIGHT;
  const endTime = formatMinutes(shoot.end);
  if (light.overlaps.golden > 0) {
    return `Your shoot runs to ${endTime} and catches ${light.overlaps.golden} min of golden hour.`;
  }

  const dayOffset = Math.floor(shoot.end / 1440);
  const endMinute = shoot.end % 1440;
  const endTimes = dayOffset === 0 ? times : getSunTimes(addDays(date, dayOffset));
  if (!endTimes) return INCOMPLETE_INSIGHT;

  if (
    includesMinute(endTimes.blue.morning, endMinute) ||
    includesMinute(endTimes.blue.evening, endMinute)
  ) {
    return `Your shoot runs to ${endTime}, in blue hour, after the golden light.`;
  }

  const minutesBeforeGolden = endTimes.golden.evening.start - endMinute;
  if (
    includesMinute(endTimes.day, endMinute) &&
    minutesBeforeGolden > 0 &&
    minutesBeforeGolden <= SHORTLY_BEFORE_GOLDEN_MINUTES
  ) {
    return `Your shoot ends at ${endTime}, ${minutesBeforeGolden} min before golden hour starts.`;
  }

  if (
    includesMinute(endTimes.day, endMinute) ||
    includesMinute(endTimes.golden.morning, endMinute) ||
    includesMinute(endTimes.golden.evening, endMinute)
  ) {
    return `Your shoot runs to ${endTime} in full daylight.`;
  }

  return `Your shoot runs to ${endTime}, after dark. Plan for artificial light.`;
}

/**
 * Responsive, fixed-location light preview for Carlton Gardens, Melbourne.
 * The form remains the source of truth; pointer and shortcut picks are emitted to the parent.
 */
export default function LightTimeline({ date, startTime, duration, onPickTime }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const ignoreClickUntilRef = useRef(0);
  const titleId = useId();
  const descriptionId = useId();
  const [chartWidth, setChartWidth] = useState(0);
  const [pointerMinutes, setPointerMinutes] = useState(null);
  const prefersReducedMotion = useReducedMotion();

  const fallbackDate = useMemo(todayInMelbourne, []);
  const previewDate = date || fallbackDate;
  const times = useMemo(() => getSunTimes(previewDate), [previewDate]);
  const shoot = useMemo(() => shootWindow(startTime, duration), [startTime, duration]);
  const light = useMemo(
    () => describeLight(previewDate, startTime, duration),
    [previewDate, startTime, duration]
  );

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;
    const measure = () => setChartWidth(element.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      setChartWidth(Number.isFinite(width) ? width : element.getBoundingClientRect().width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [times]);

  if (!times) {
    return (
      <section ref={containerRef} className="light-timeline light-timeline--unavailable">
        <div className="light-timeline-head">
          <div>
            <h3 className="light-timeline-title">Light on the day</h3>
            <p className="light-timeline-subtitle">Choose a valid shoot date to preview the light.</p>
          </div>
        </div>
      </section>
    );
  }

  const domain = buildDomain(times);
  const domainLength = domain.end - domain.start;
  const measuredChartWidth = Math.max(MIN_CHART_WIDTH, Math.round(chartWidth || MIN_CHART_WIDTH));
  const plotLeft = HORIZONTAL_PADDING;
  const plotRight = measuredChartWidth - HORIZONTAL_PADDING;
  const plotWidth = plotRight - plotLeft;
  const xFor = (minute) => plotLeft + ((minute - domain.start) / domainLength) * plotWidth;
  const boundedX = (minute) => xFor(clamp(minute, domain.start, domain.end));
  const widthFor = (interval) => Math.max(0, boundedX(interval.end) - boundedX(interval.start));
  const tickStep = chartWidth > 0 && chartWidth < NARROW_WIDTH ? 4 : 2;
  const ticks = buildTicks(domain.start, domain.end, tickStep);
  const selectedMinutes = parseTime(startTime);
  const selectedInDomain = selectedMinutes !== null && selectedMinutes >= domain.start && selectedMinutes <= domain.end;
  const dotMinutes = selectedInDomain ? selectedMinutes : times.solarNoon;
  const dotY = dotMinutes >= times.sunrise && dotMinutes <= times.sunset
    ? arcY(dotMinutes, times.sunrise, times.sunset)
    : HORIZON_Y;
  const dotLabel = selectedInDomain ? `Selected time ${formatMinutes(dotMinutes)}` : "Solar noon preview";

  const arcPoints = Array.from({ length: 33 }, (_, index) => {
    const minute = times.sunrise + ((times.sunset - times.sunrise) * index) / 32;
    return `${index === 0 ? "M" : "L"} ${xFor(minute).toFixed(2)} ${arcY(
      minute,
      times.sunrise,
      times.sunset
    ).toFixed(2)}`;
  }).join(" ");

  const intervals = [
    { key: "morning-blue", label: "Morning blue hour", tone: "blue", ...times.blue.morning },
    { key: "morning-golden", label: "Morning golden hour", tone: "golden", ...times.golden.morning },
    { key: "day", label: "Daylight", tone: "day", ...times.day },
    { key: "evening-golden", label: "Evening golden hour", tone: "golden", ...times.golden.evening },
    { key: "evening-blue", label: "Evening blue hour", tone: "blue", ...times.blue.evening },
  ];

  const insight = shoot && light
    ? conditionInsight(previewDate, shoot, light, times)
    : INCOMPLETE_INSIGHT;

  const subtitle = date ? "Melbourne sun times" : "Today, until you pick a date";
  const clipId = `${descriptionId.replace(/:/g, "")}-light-bounds`;
  const daylightGradientId = `${descriptionId.replace(/:/g, "")}-daylight-gradient`;
  const arcGradientId = `${descriptionId.replace(/:/g, "")}-arc-gradient`;
  const chartDescription = [
    `Approximate light at ${DEFAULT_COORDS.name}, Melbourne on ${formatDate(previewDate)}.`,
    `Sunrise is ${formatMinutes(times.sunrise)} and sunset is ${formatMinutes(times.sunset)}.`,
    `Morning golden hour is ${intervalText(times.golden.morning)} and evening golden hour is ${intervalText(times.golden.evening)}.`,
    insight,
  ].join(" ");

  const pointerFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return null;
    const viewBoxX = ((event.clientX - rect.left) / rect.width) * measuredChartWidth;
    const ratio = clamp((viewBoxX - plotLeft) / plotWidth, 0, 1);
    return snapMinutes(domain.start + ratio * domainLength);
  };

  const handlePick = (event) => {
    if (Date.now() < ignoreClickUntilRef.current) return;
    const picked = pointerFromEvent(event);
    const value = picked === null ? "" : toTimeValue(picked);
    if (value) onPickTime?.(value);
  };

  const handlePointerPick = (event) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    const picked = pointerFromEvent(event);
    const value = picked === null ? "" : toTimeValue(picked);
    if (!value) return;
    ignoreClickUntilRef.current = Date.now() + 500;
    onPickTime?.(value);
  };

  const handleGoldenPick = () => {
    onPickTime?.(toTimeValue(goldenShortcut(times.golden.evening, duration)));
  };

  const visibleWindow = shoot
    ? {
        start: clamp(shoot.start, domain.start, domain.end),
        end: clamp(shoot.end, domain.start, domain.end),
      }
    : null;
  const windowTone = light?.overlaps.golden > 0 ? "golden" : "standard";
  const windowTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 240, damping: 30, mass: 0.8 };

  return (
    <section ref={containerRef} className="light-timeline" aria-labelledby={titleId}>
      <div className="light-timeline-head">
        <div>
          <h3 id={titleId} className="light-timeline-title">Light on the day</h3>
          <p className="light-timeline-subtitle">{subtitle}</p>
        </div>
        <ul className="light-timeline-legend" aria-label="Key light times">
          <li className="light-timeline-legend-item">
            <Sunrise aria-hidden="true" />
            <span>Sunrise</span>
            <strong>{formatMinutes(times.sunrise)}</strong>
          </li>
          <li className="light-timeline-legend-item light-timeline-legend-item--golden">
            <Sparkles aria-hidden="true" />
            <span>Golden hour</span>
            <strong>{intervalText(times.golden.evening)}</strong>
          </li>
          <li className="light-timeline-legend-item">
            <Sunset aria-hidden="true" />
            <span>Sunset</span>
            <strong>{formatMinutes(times.sunset)}</strong>
          </li>
        </ul>
      </div>

      <svg
        ref={chartRef}
        className="light-timeline-svg"
        viewBox={`0 0 ${measuredChartWidth} ${CHART_HEIGHT}`}
        width="100%"
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
        data-tick-step={tickStep}
        onPointerMove={(event) => setPointerMinutes(pointerFromEvent(event))}
        onPointerLeave={() => setPointerMinutes(null)}
        onPointerUp={handlePointerPick}
        onClick={handlePick}
      >
        <title>Daylight and shoot window timeline</title>
        <desc id={descriptionId}>{chartDescription}</desc>
        <defs>
          <clipPath id={clipId}>
            <rect x={plotLeft} y={CHART_TOP} width={plotWidth} height={CHART_BACKGROUND_HEIGHT} rx="12" />
          </clipPath>
          <linearGradient id={daylightGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="light-timeline-day-stop light-timeline-day-stop--top" />
            <stop offset="100%" className="light-timeline-day-stop light-timeline-day-stop--bottom" />
          </linearGradient>
          <linearGradient id={arcGradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" className="light-timeline-arc-stop light-timeline-arc-stop--edge" />
            <stop offset="50%" className="light-timeline-arc-stop light-timeline-arc-stop--peak" />
            <stop offset="100%" className="light-timeline-arc-stop light-timeline-arc-stop--edge" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect
            className="light-timeline-band light-timeline-band--night"
            data-testid="light-background-night"
            x={plotLeft}
            y={CHART_TOP}
            width={plotWidth}
            height={CHART_BACKGROUND_HEIGHT}
          />
          <rect
            className="light-timeline-band light-timeline-band--day"
            data-testid="light-background-day"
            x={boundedX(times.sunrise)}
            y={CHART_TOP}
            width={widthFor({ start: times.sunrise, end: times.sunset })}
            height={CHART_BACKGROUND_HEIGHT}
            fill={`url(#${daylightGradientId})`}
          />
          {intervals.map((interval) => interval.tone === "day" ? null : (
            <rect
              key={interval.key}
              className={`light-timeline-band light-timeline-band--${interval.tone}`}
              data-testid={`light-band-${interval.key}`}
              aria-label={`${interval.label}: ${intervalText(interval)}`}
              x={boundedX(interval.start)}
              y={CHART_TOP}
              width={widthFor(interval)}
              height={CHART_BACKGROUND_HEIGHT}
            />
          ))}
          {visibleWindow && visibleWindow.end > visibleWindow.start && (
            <motion.rect
              className={`light-timeline-window light-timeline-window--${windowTone}`}
              data-testid="shoot-window"
              data-tone={windowTone}
              y={CHART_TOP}
              height={CHART_BACKGROUND_HEIGHT}
              rx="9"
              initial={false}
              animate={{
                x: boundedX(visibleWindow.start),
                width: widthFor(visibleWindow),
              }}
              transition={windowTransition}
            />
          )}
        </g>
        <line className="light-timeline-horizon" x1={plotLeft} y1={HORIZON_Y} x2={plotRight} y2={HORIZON_Y} />
          <motion.path
            className="light-timeline-arc"
            data-testid="solar-arc"
            data-motion={prefersReducedMotion ? "reduced" : "draw"}
            d={arcPoints}
            stroke={`url(#${arcGradientId})`}
            pathLength="1"
            initial={prefersReducedMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: "easeOut" }}
          />
          <motion.g
            className="light-timeline-sun-dot"
            data-testid="sun-position"
            data-motion={prefersReducedMotion ? "reduced" : "glow"}
            aria-label={dotLabel}
            initial={false}
            animate={{ x: xFor(dotMinutes), y: dotY }}
            transition={windowTransition}
          >
            <motion.circle
              className="light-timeline-sun-dot-halo"
              r="13"
              animate={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: [0.65, 1, 0.65], scale: [0.9, 1.12, 0.9] }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <circle className="light-timeline-sun-dot-core" r="7" />
          </motion.g>
          {pointerMinutes !== null && (
            <g className="light-timeline-pointer" aria-hidden="true" data-testid="pointer-guide">
              <line x1={boundedX(pointerMinutes)} y1={CHART_TOP} x2={boundedX(pointerMinutes)} y2={CHART_BOTTOM} />
              <rect x={clamp(boundedX(pointerMinutes) - 42, plotLeft, plotRight - 84)} y="3" width="84" height="24" rx="12" />
              <text x={clamp(boundedX(pointerMinutes), plotLeft + 42, plotRight - 42)} y="20" textAnchor="middle">{formatMinutes(pointerMinutes)}</text>
            </g>
          )}
          {ticks.map((tick) => (
            <g className="light-timeline-tick" key={tick}>
              <line x1={xFor(tick)} y1={HORIZON_Y + 4} x2={xFor(tick)} y2={HORIZON_Y + 11} />
              <text x={xFor(tick)} y={HORIZON_Y + 32} textAnchor="middle">{formatMinutes(tick).replace(":00", "")}</text>
            </g>
          ))}
      </svg>

      <div className="light-timeline-foot">
        <p className="light-timeline-insight" role="status" aria-live="polite">{insight}</p>
        <button type="button" className="light-timeline-golden-action" onClick={handleGoldenPick} disabled={!onPickTime}>
          <Sparkles aria-hidden="true" />
          <span>Start at golden hour</span>
        </button>
      </div>
    </section>
  );
}
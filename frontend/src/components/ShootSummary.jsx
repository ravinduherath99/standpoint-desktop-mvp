import { useEffect, useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Aperture,
  Backpack,
  CalendarDays,
  ChevronDown,
  Clock,
  MapPin,
  Timer,
  Users,
} from "lucide-react";
import carltonImg from "../assets/carlton-gardens.jpg";
import {
  durationMinutes,
  formatDate,
  formatShootWindow,
  parseTime,
} from "../lib/format";
import { describeLight } from "../lib/sun";

const COMPACT_QUERY = "(max-width: 900px)";
const LIGHT_LABELS = Object.freeze({
  golden: "Golden light",
  blue: "Blue hour",
  day: "Daylight",
  night: "Night",
});

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function listValue(value) {
  return Array.isArray(value) ? value.filter(hasText).join(", ") : "";
}

/**
 * ShootSummary — live summary card shown in the planner sidebar.
 * Displays a responsive location overview, readiness status, fixed-location
 * light estimate, and six progressively populated detail groups.
 *
 * @param {{ data: Object }} props
 */
export default function ShootSummary({ data }) {
  const detailsId = useId();
  const prefersReducedMotion = useReducedMotion();
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(COMPACT_QUERY).matches
      : false
  );
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(COMPACT_QUERY);
    const update = (event) => setIsCompact(event.matches);
    setIsCompact(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const safeData = data || {};
  const location = hasText(safeData.location) ? safeData.location.trim() : "";
  const shootTypes = listValue(safeData.shootTypes);
  const equipment = listValue(safeData.equipment);
  const date = formatDate(safeData.shootDate);
  const timeWindow = formatShootWindow(safeData.startTime, safeData.duration);
  const duration = durationMinutes(safeData.duration) === null ? "" : safeData.duration;
  const people = hasText(String(safeData.people ?? "")) ? String(safeData.people).trim() : "";
  const completed = [
    Boolean(date),
    parseTime(safeData.startTime) !== null,
    Boolean(duration),
    Boolean(shootTypes),
    Boolean(people),
    Boolean(equipment),
  ].filter(Boolean).length;
  const light = useMemo(
    () => describeLight(safeData.shootDate, safeData.startTime, safeData.duration),
    [safeData.shootDate, safeData.startTime, safeData.duration]
  );
  const lightLabel = light ? LIGHT_LABELS[light.tone] : "";
  const detailsVisible = !isCompact || detailsExpanded;

  const detailItems = [
    { label: "Date", value: date, Icon: CalendarDays },
    { label: "Time", value: timeWindow, Icon: Clock },
    { label: "Duration", value: duration, Icon: Timer },
    { label: "Shoot type", value: shootTypes, Icon: Aperture },
    { label: "People", value: people, Icon: Users },
    { label: "Equipment", value: equipment, Icon: Backpack },
  ];

  return (
    <aside className="shoot-summary" aria-label="Live shoot summary">
      <div className="shoot-summary-image">
        <img
          src={carltonImg}
          alt="Carlton Gardens location preview"
          loading="lazy"
        />
        <span className="shoot-summary-label">LIVE SUMMARY</span>
      </div>

      <div className="shoot-summary-body">
        <div className="shoot-summary-overview">
          <div className="shoot-summary-heading-group">
            {location && (
              <h3 className="shoot-summary-title">
                <MapPin size={18} aria-hidden="true" />
                <span>{location}</span>
              </h3>
            )}
            {lightLabel && (
              <div className={`shoot-summary-light shoot-summary-light--${light.tone}`}>
                <span className="shoot-summary-light-label">{lightLabel}</span>
                <span className="shoot-summary-light-basis">Based on Carlton Gardens, Melbourne</span>
              </div>
            )}
          </div>

          <div
            className="shoot-summary-readiness"
            role="img"
            aria-label={`${completed} of 6 details filled`}
          >
            <span
              className="shoot-summary-readiness-ring"
              aria-hidden="true"
            >
              <svg className="shoot-summary-readiness-svg" viewBox="0 0 62 62">
                <circle className="shoot-summary-readiness-track" cx="31" cy="31" r="27" />
                <motion.circle
                  className="shoot-summary-readiness-progress"
                  data-motion={prefersReducedMotion ? "reduced" : "spring"}
                  cx="31"
                  cy="31"
                  r="27"
                  pathLength="1"
                  initial={false}
                  animate={{ pathLength: completed / 6 }}
                  transition={prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 180, damping: 24, mass: 0.8 }}
                />
              </svg>
              <span className="shoot-summary-readiness-value">
                <strong>{completed}</strong>
                <span>/6</span>
              </span>
            </span>
            <span className="shoot-summary-readiness-label">Details filled</span>
          </div>
        </div>

        <button
          type="button"
          className="shoot-summary-disclosure"
          aria-expanded={detailsVisible}
          aria-controls={detailsId}
          onClick={() => setDetailsExpanded((expanded) => !expanded)}
        >
          <span>{detailsExpanded ? "Hide details" : "Show details"}</span>
          <ChevronDown
            className={detailsExpanded ? "shoot-summary-disclosure-icon shoot-summary-disclosure-icon--open" : "shoot-summary-disclosure-icon"}
            size={18}
            aria-hidden="true"
          />
        </button>

        <dl id={detailsId} className="shoot-summary-grid" hidden={!detailsVisible}>
          {detailItems.map(({ label, value, Icon }) => (
            <div className="shoot-summary-cell" key={label}>
              <dt>
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </dt>
              <dd className={!value ? "shoot-summary-value--empty" : undefined} aria-live="polite">
                {value || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}

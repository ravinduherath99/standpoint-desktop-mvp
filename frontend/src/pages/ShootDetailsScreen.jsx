import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  validateLocation,
  validateShootDate,
  validateRequired,
  validateDuration,
  validateSelection,
  validateForm,
} from "../utils/validation";
import FormSection from "../components/FormSection";
import FormField from "../components/FormField";
import FlowButton from "../components/FlowButton";
import ChoiceChips from "../components/ChoiceChips";
import SegmentedControl from "../components/SegmentedControl";
import LocationSearch from "../components/LocationSearch";
import LightTimeline from "../components/LightTimeline";
import {
  Calendar,
  ClipboardCheck,
  Clock,
  Heart,
  MapPin,
  Shirt,
  UserRound,
  Utensils,
} from "lucide-react";

const SHOOT_TYPES = [
  { value: "Pre-shoot", label: "Pre-shoot", icon: ClipboardCheck },
  { value: "Wedding", label: "Wedding", icon: Heart },
  { value: "Portrait", label: "Portrait", icon: UserRound },
  { value: "Fashion", label: "Fashion", icon: Shirt },
  { value: "Food", label: "Food", icon: Utensils },
];

const DURATION_OPTIONS = [
  { value: "60 minutes", label: "60 min" },
  { value: "90 minutes", label: "90 min" },
  { value: "2 hours", label: "2 hr" },
  { value: "3 hours", label: "3 hr" },
];

function validateStartTime(value) {
  return validateRequired(value) ? "Start time is required." : "";
}

/**
 * ShootDetailsScreen — location, date, time, duration and shoot-type choices.
 * Controlled inputs; touched-based validation; Continue navigates forward.
 *
 * @param {{ data: Object, onChange: Function, onToggle: Function }} props
 */
export default function ShootDetailsScreen({ data, onChange, onToggle }) {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const headingRef = useRef(null);
  const [touched, setTouched] = useState({
    location: false,
    shootDate: false,
    startTime: false,
    duration: false,
    shootTypes: false,
  });

  const shootTypesError = validateSelection(
    data.shootTypes,
    "Select at least one shoot type."
  );

  const durationError = validateDuration(data.duration);

  const errors = {
    location: validateLocation(data.location),
    shootDate: validateShootDate(data.shootDate),
    startTime: validateStartTime(data.startTime),
    duration: durationError,
    shootTypes: shootTypesError,
  };

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({
      location: true,
      shootDate: true,
      startTime: true,
      duration: true,
      shootTypes: true,
    });

    const { firstInvalidField } = validateForm({
      location: () => validateLocation(data.location),
      shootDate: () => validateShootDate(data.shootDate),
      startTime: () => validateStartTime(data.startTime),
      duration: () => validateDuration(data.duration),
      shootTypes: () =>
        validateSelection(data.shootTypes, "Select at least one shoot type."),
    });
    if (firstInvalidField) {
      requestAnimationFrame(() => {
        const first = formRef.current?.querySelector('[aria-invalid="true"]');
        first?.focus();
      });
      return;
    }
    navigate("/crew-equipment");
  };

  return (
    <div className="page-inner">
      <p className="page-eyebrow">Step 1 &middot; Where and when</p>
      <h1 tabIndex={-1} ref={headingRef} className="page-title">
        Shoot Details
      </h1>
      <p className="page-subtitle">
        Pick the spot and the time. The light preview shows how your slot sits against sunset.
      </p>

      <form ref={formRef} className="form" onSubmit={handleSubmit} noValidate>
        <FormSection title="Where you're shooting" id="shoot-location-section" icon={MapPin}>
          <FormField
            label="Location"
            id="shoot-location"
            type="text"
            value={data.location}
            onChange={(e) => onChange("location", e.target.value)}
            onBlur={() => handleBlur("location")}
            error={touched.location && errors.location ? errors.location : undefined}
            maxLength={160}
          />

          <LocationSearch location={data.location} onChange={onChange} />
        </FormSection>

        <FormSection title="When" id="shoot-when" icon={Calendar}>
          <div className="field-row shoot-details-date-time">
            <FormField
              label="Shoot date"
              id="shoot-date"
              type="date"
              value={data.shootDate}
              onChange={(e) => onChange("shootDate", e.target.value)}
              onBlur={() => handleBlur("shootDate")}
              error={touched.shootDate && errors.shootDate ? errors.shootDate : undefined}
              icon={Calendar}
            />

            <FormField
              label="Start time"
              id="shoot-time"
              type="time"
              step={900}
              value={data.startTime}
              helper="Enter a time here, click the light preview, or use its golden-hour shortcut."
              onChange={(e) => onChange("startTime", e.target.value)}
              onBlur={() => handleBlur("startTime")}
              error={touched.startTime && errors.startTime ? errors.startTime : undefined}
              icon={Clock}
            />
          </div>

          <SegmentedControl
            label="Duration"
            name="shoot-duration"
            options={DURATION_OPTIONS}
            value={data.duration}
            onChange={(value) => {
              onChange("duration", value);
              setTouched((prev) => ({ ...prev, duration: true }));
            }}
            error={touched.duration && errors.duration ? errors.duration : undefined}
          />

          <LightTimeline
            date={data.shootDate}
            startTime={data.startTime}
            duration={data.duration}
            onPickTime={(time) => onChange("startTime", time)}
          />
        </FormSection>

        <FormSection title="Shoot type" id="shoot-type">
          <div className="field">
            <ChoiceChips
              label="Choose one or more"
              name="shootTypes"
              options={SHOOT_TYPES}
              selected={data.shootTypes}
              error={touched.shootTypes && errors.shootTypes ? errors.shootTypes : undefined}
              variant="tiles"
              onToggle={(value) => {
                onToggle("shootTypes", value);
                setTouched((prev) => ({ ...prev, shootTypes: true }));
              }}
            />
          </div>
        </FormSection>

        <div className="form-actions">
          <FlowButton type="submit" text="Continue" />
        </div>
      </form>
    </div>
  );
}

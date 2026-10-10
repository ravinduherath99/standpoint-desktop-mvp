import { Minus, Plus } from "lucide-react";

/**
 * NumberStepper — controlled number input with accessible increment controls.
 * Empty values stay empty until the user changes the input or increments it.
 *
 * @param {{
 *   id: string,
 *   label: string,
 *   value: string | number,
 *   onChange: (value: string) => void,
 *   onBlur?: () => void,
 *   helper?: string,
 *   error?: string,
 *   min?: number,
 *   max?: number
 * }} props
 */
export default function NumberStepper({
  id,
  label,
  value,
  onChange,
  onBlur,
  helper,
  error,
  min = 1,
  max = 50,
}) {
  const stringValue = value == null ? "" : String(value);
  const numericValue = Number(stringValue);
  const hasNumber = stringValue.trim() !== "" && Number.isFinite(numericValue);
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy = [helper ? helperId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;
  const decrementDisabled = !hasNumber || numericValue <= min;
  const incrementDisabled = hasNumber && numericValue >= max;
  const hasVisualValue = hasNumber
    && Number.isInteger(numericValue)
    && numericValue >= min
    && numericValue <= max;
  const visiblePeople = hasVisualValue
    ? Math.min(numericValue, 8)
    : 0;
  const additionalPeople = hasVisualValue && numericValue > 8
    ? numericValue - 8
    : 0;

  const step = (direction) => {
    if (direction < 0 && decrementDisabled) return;
    if (direction > 0 && incrementDisabled) return;

    const nextValue = hasNumber
      ? Math.min(max, Math.max(min, Math.trunc(numericValue) + direction))
      : min;
    onChange(String(nextValue));
  };

  const handleChange = (event) => {
    const nextValue = event.target.value;
    if (nextValue === "") {
      onChange("");
      return;
    }

    const parsedValue = Number(nextValue);
    if (!Number.isFinite(parsedValue)) return;
    onChange(String(Math.min(max, Math.max(min, Math.trunc(parsedValue)))));
  };

  return (
    <div className="field stepper-field">
      <label htmlFor={id}>{label}</label>
      <div className={`stepper${error ? " stepper--invalid" : ""}`}>
        <button
          type="button"
          className="stepper-btn"
          onClick={() => step(-1)}
          disabled={decrementDisabled}
          aria-label="Decrease people on site"
        >
          <Minus size={18} aria-hidden="true" />
        </button>

        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step="1"
          value={stringValue}
          onChange={handleChange}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />

        <button
          type="button"
          className="stepper-btn"
          onClick={() => step(1)}
          disabled={incrementDisabled}
          aria-label="Increase people on site"
        >
          <Plus size={18} aria-hidden="true" />
        </button>

        <span className="stepper-figures" aria-hidden="true">
          {Array.from({ length: visiblePeople }, (_, index) => (
            <svg
              key={index}
              viewBox="0 0 16 22"
              className="stepper-figure"
              style={{ "--i": index }}
            >
              <circle cx="8" cy="5" r="4" />
              <path d="M1 21v-4.5C1 12.9 4.1 10.5 8 10.5s7 2.4 7 6V21Z" />
            </svg>
          ))}

          {additionalPeople > 0 && (
            <span className="stepper-more">+{additionalPeople}</span>
          )}
        </span>
      </div>
      {helper && (
        <span id={helperId} className="field-helper">
          {helper}
        </span>
      )}
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
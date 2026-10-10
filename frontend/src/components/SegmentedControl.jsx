import { useId } from "react";

/**
 * SegmentedControl — controlled single-select radio group.
 * Native radios preserve expected keyboard and screen-reader behaviour while
 * their labels provide the segmented visual treatment.
 *
 * @param {{
 *   label: string,
 *   name: string,
 *   options: Array<{ value: string, label: string }>,
 *   value: string,
 *   onChange: (value: string) => void,
 *   error?: string
 * }} props
 */
export default function SegmentedControl({
  label,
  name,
  options,
  value,
  onChange,
  error,
}) {
  const generatedId = useId().replace(/:/g, "");
  const labelId = `${name}-${generatedId}-label`;
  const errorId = `${name}-${generatedId}-error`;

  return (
    <fieldset
      className={`segmented-control${error ? " segmented-control--error" : ""}`}
      aria-labelledby={labelId}
      aria-describedby={error ? errorId : undefined}
    >
      <legend id={labelId} className="segmented-control-label">
        {label}
      </legend>
      <div className="segmented-control-options">
        {options.map((option, index) => {
          const optionId = `${name}-${generatedId}-${option.value.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
          return (
            <div className="segmented-control-option" key={option.value}>
              <input
                id={optionId}
                className="segmented-control-input"
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                aria-describedby={error ? errorId : undefined}
                aria-invalid={error && index === 0 ? true : undefined}
                onChange={(event) => onChange(event.target.value)}
              />
              <label className="segmented-control-segment" htmlFor={optionId}>
                {option.label}
              </label>
            </div>
          );
        })}
      </div>
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </fieldset>
  );
}
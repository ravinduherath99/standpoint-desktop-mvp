import { Check } from "lucide-react";

/**
 * ChoiceChips — reusable multi-select chip group.
 *
 * Renders a list of buttons that visually indicate selected state.
 * Uses native <button> elements for keyboard accessibility.
 *
 * @param {{
 *   label: string,
 *   options: Array<string | { value: string, label?: string, icon?: React.ComponentType<any> }>,
 *   selected: string[],
 *   onToggle: (value: string) => void,
 *   name: string,
 *   error?: string,
 *   flaggedOptions?: string[],
 *   variant?: "chips" | "tiles"
 * }} props
 */
export default function ChoiceChips({
  label,
  options,
  selected,
  onToggle,
  name,
  error,
  flaggedOptions = [],
  variant = "chips",
}) {
  const errorId = `${name}-error`;
  const normalizedOptions = options.map((option) =>
    typeof option === "string"
      ? { value: option, label: option, icon: null }
      : { value: option.value, label: option.label || option.value, icon: option.icon || null }
  );

  return (
    <fieldset
      className={`choice-chips choice-chips--${variant}${error ? " choice-chips--error" : ""}`}
      aria-labelledby={`${name}-label`}
      aria-describedby={error ? errorId : undefined}
    >
      <legend id={`${name}-label`} className="choice-chips-label">
        {label}
      </legend>
      <div className="choice-chips-list" role="group" aria-label={label}>
        {normalizedOptions.map((option, index) => {
          const Icon = option.icon;
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={[
                "choice-chip",
                isSelected && "choice-chip--selected",
                flaggedOptions.includes(option.value) && "choice-chip--flagged",
              ].filter(Boolean).join(" ")}
              aria-pressed={isSelected}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error && index === 0 ? true : undefined}
              onClick={() => onToggle(option.value)}
            >
              {Icon && (
                <span className="choice-chip-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
              )}
              <span className="choice-chip-label">{option.label}</span>
              {isSelected && (
                <span className="choice-chip-check" aria-hidden="true">
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
            </button>
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

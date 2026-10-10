import { useId } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function FormField({
  label, name, id, helper, error, icon: Icon,
  multiline = false, options, className = "",
  maxLength, showCharCount = false,
  togglePassword, showPassword, endAdornment, counter: counterProp,
  ...props
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;
  const counterId = `${fieldId}-counter`;

  const counter = counterProp || (showCharCount && maxLength != null ? { max: maxLength } : null);
  const showCounter = counter != null && !options;
  const trimmedLen = String(props.value || "").trim().length;
  let counterState = "field-counter--under";
  if (showCounter) {
    const minVal = counter.min || 0;
    if (trimmedLen > counter.max) counterState = "field-counter--over";
    else if (trimmedLen >= minVal) counterState = "field-counter--ok";
  }
  const pct = showCounter ? Math.min(100, Math.round((trimmedLen / counter.max) * 100)) : 0;
  const describedBy = [helper ? helperId : null, showCounter ? counterId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const controlProps = { id: fieldId, name, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, maxLength, ...props };
  let Control;
  if (options) Control = (<select {...controlProps}>{options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}</select>);
  else if (multiline) Control = <textarea rows={5} {...controlProps} />;
  else Control = <input {...controlProps} />;
  const needsWrapper = endAdornment || togglePassword;
  const wrappedControl = needsWrapper ? (
    <div className="field-control-wrapper">
      {Control}
      {endAdornment && <span className="field-end-adornment">{endAdornment}</span>}
      {togglePassword && (
        <button type="button" className="field-toggle" onClick={togglePassword}
          aria-label={showPassword ? "Hide input" : "Show input"} tabIndex={-1}>
          {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      )}
    </div>
  ) : null;
  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={fieldId}>
        {Icon && <Icon size={14} className="field-icon" aria-hidden="true" />}
        {label}
      </label>
      {wrappedControl || Control}
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
      {showCounter && (
        <div className={counterState}>
          <div className="field-counter-bar">
            <div className="field-counter-fill" style={{ width: pct + "%" }} />
          </div>
          <span id={counterId} className="field-counter-text">
            {trimmedLen} / {counter.max}
          </span>
        </div>
      )}
    </div>
  );
}

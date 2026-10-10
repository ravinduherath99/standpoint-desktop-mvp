import { ArrowRight } from "lucide-react";

/**
 * FlowButton — animated forward button with arrow and expanding circle.
 * Used for primary form submission (Continue / Submit).
 *
 * @param {{
 *   text?: string,
 *   type?: "button" | "submit" | "reset",
 *   disabled?: boolean,
 *   loading?: boolean,
 *   className?: string,
 *   onClick?: (e: any) => void,
 *   "aria-label"?: string
 * }} props
 */
export default function FlowButton({
  text = "Continue",
  type = "button",
  disabled = false,
  loading = false,
  className: callerClass,
  ...restProps
}) {
  const isDisabled = disabled || loading;

  const className = [
    "flow-button",
    isDisabled && "flow-button--disabled",
    callerClass,
  ].filter(Boolean).join(" ");

  return (
    <button
      type={type}
      className={className}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...restProps}
    >
      {/* Left arrow */}
      <ArrowRight
        className="flow-button__arrow flow-button__arrow--left"
        aria-hidden="true"
      />

      {/* Text */}
      <span className="flow-button__text">{text}</span>

      {/* Expanding circle */}
      <span className="flow-button__circle" aria-hidden="true" />

      {/* Right arrow */}
      <ArrowRight
        className="flow-button__arrow flow-button__arrow--right"
        aria-hidden="true"
      />
    </button>
  );
}

import { LoaderCircle } from "lucide-react";

/**
 * ActionButton — tactile but restrained button component.
 * Supports primary/secondary variants, loading state with spinner,
 * and disabled semantics. Renders a native <button>.
 *
 * @param {{
 *   children: React.ReactNode,
 *   type?: "button" | "submit" | "reset",
 *   variant?: "primary" | "secondary",
 *   loading?: boolean,
 *   disabled?: boolean,
 *   className?: string,
 *   onClick?: (e: any) => void,
 *   "aria-label"?: string
 * }} props
 */
export default function ActionButton({
  children,
  type = "button",
  variant = "primary",
  loading = false,
  ...props
}) {
  const {
    className: callerClass,
    disabled: callerDisabled,
    ...restProps
  } = props;

  const isDisabled = loading || callerDisabled;

  const className = [
    "action-button",
    variant,
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
      {loading && (
        <LoaderCircle
          size={16}
          className="action-button-spinner"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

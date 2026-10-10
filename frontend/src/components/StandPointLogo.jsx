/**
 * StandPointLogo — reusable SVG vector logo.
 * Uses currentColor for fill so it adapts to light/dark contexts.
 *
 * @param {{
 *   className?: string,
 *   width?: number | string,
 *   height?: number | string,
 *   "aria-label"?: string,
 *   decorative?: boolean
 * }} props
 */
export default function StandPointLogo({
  className = "",
  width = 130,
  height,
  "aria-label": ariaLabel = "StandPoint",
  decorative = false,
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 48"
      width={width}
      height={height}
      className={className}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : ariaLabel}
      fill="currentColor"
    >
      {!decorative && <title>{ariaLabel}</title>}
      {/* Camera-aperture mark */}
      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="24" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
      {/* Aperture blades */}
      <line x1="24" y1="4" x2="24" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="32" x2="24" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="24" x2="16" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Wordmark */}
      <text
        x="56"
        y="32"
        fontFamily="'Outfit', sans-serif"
        fontWeight="700"
        fontSize="28"
        letterSpacing="-0.01em"
        fill="currentColor"
      >
        StandPoint
      </text>
    </svg>
  );
}

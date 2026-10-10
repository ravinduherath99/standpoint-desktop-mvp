import { useId } from "react";
import markSrc from "../assets/standpoint-icon-blue-transparent.png";

/**
 * BrandLogo — official StandPoint mark + readable wordmark.
 */
export default function BrandLogo({
  tone = "dark",
  size = 32,
  className = "",
  decorative = false,
}) {
  const titleId = useId();
  const isLight = tone === "light";
  return (
    <span
      className={["brand-logo", `brand-logo--${isLight ? "light" : "dark"}`, className]
        .filter(Boolean)
        .join(" ")}
      style={{ "--brand-size": size + "px" }}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? "true" : undefined}
      aria-labelledby={decorative ? undefined : titleId}
    >
      {!decorative && (
        <span id={titleId} className="sr-only">
          StandPoint
        </span>
      )}
      <img
        className="brand-logo-mark"
        src={markSrc}
        alt=""
        aria-hidden="true"
      />
      <span className="brand-logo-word" aria-hidden="true">
        <span className="brand-logo-stand">stand</span>
        <span className="brand-logo-point">point</span>
      </span>
    </span>
  );
}

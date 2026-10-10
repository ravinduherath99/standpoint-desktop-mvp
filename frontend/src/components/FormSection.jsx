/**
 * FormSection — stateless reusable card wrapper for grouped form areas.
 * Renders a semantic <section> with heading, optional icon, optional description,
 * and children. Compact mode tightens spacing.
 *
 * @param {{
 *   title: string,
 *   description?: string,
 *   icon?: React.ComponentType<any>,
 *   children: React.ReactNode,
 *   compact?: boolean,
 *   id?: string
 * }} props
 */
export default function FormSection({
  title,
  description,
  icon: Icon,
  children,
  compact = false,
  id,
}) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section
      className={`form-section${compact ? " compact" : ""}`}
      aria-labelledby={headingId}
    >
      <div className="form-section-header">
        {Icon && (
          <span className="form-section-icon" aria-hidden="true">
            <Icon size={18} />
          </span>
        )}
        <div className="form-section-header-text">
          <h2 id={headingId} className="form-section-title">
            {title}
          </h2>
          {description && (
            <p className="form-section-desc">{description}</p>
          )}
        </div>
      </div>
      <div className="form-section-body">{children}</div>
    </section>
  );
}

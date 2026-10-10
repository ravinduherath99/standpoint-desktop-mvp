import { useLocation, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

const STEPS = [
  { path: "/shoot-details", label: "Shoot Details", hint: "Where and when", unavailable: "" },
  {
    path: "/crew-equipment",
    label: "Crew & Kit",
    hint: "Who and what",
    unavailable: "Enter a valid location before opening Crew & Kit.",
  },
  {
    path: "/access-consent",
    label: "Access & Consent",
    hint: "Permissions",
    unavailable: "Enter a valid location and People value before opening Access & Consent.",
  },
];

/**
 * ProgressSidebar — responsive planner progress and completed-step navigation.
 * Completion is derived by FlowShell from the existing App-owned form data.
 *
 * @param {{ completedSteps?: boolean[], availableSteps?: boolean[] }} props
 */
export default function ProgressSidebar({
  completedSteps = [],
  availableSteps = [true, false, false],
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeIndex = Math.max(0, STEPS.findIndex((step) => step.path === pathname));
  const activeStep = STEPS[activeIndex];
  const progressValue = ((activeIndex + 1) / STEPS.length) * 100;

  return (
    <nav className="progress-sidebar" aria-label="Planning progress">
      <div className="progress-mobile-summary">
        <span className="progress-mobile-count">
          Step {activeIndex + 1} of {STEPS.length}
        </span>
        <strong className="progress-mobile-label">{activeStep.label}</strong>
        <div
          className="progress-mobile-bar"
          role="progressbar"
          aria-label="Planner step progress"
          aria-valuemin="1"
          aria-valuemax={STEPS.length}
          aria-valuenow={activeIndex + 1}
        >
          <span style={{ width: `${progressValue}%` }} />
        </div>
      </div>

      <ol
        className="progress-steps"
        style={{ "--progress-rail-ratio": activeIndex / (STEPS.length - 1) }}
      >
        {STEPS.map((step, index) => {
          const isActive = pathname === step.path;
          const completed = Boolean(completedSteps[index]);
          const showCompleted = completed && !isActive;
          const canNavigate = isActive || Boolean(availableSteps[index]);
          const descriptionId = `progress-step-${index + 1}-description`;

          return (
            <li key={step.path} className="progress-step">
              <button
                type="button"
                className={[
                  "progress-step-btn",
                  isActive && "progress-step-btn--active",
                  showCompleted && "progress-step-btn--completed",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "step" : undefined}
                aria-describedby={descriptionId}
                aria-disabled={!canNavigate ? "true" : undefined}
                onClick={() => canNavigate && navigate(step.path)}
              >
                <span className="progress-step-number" aria-hidden="true">
                  {showCompleted ? <Check size={17} strokeWidth={2.5} /> : index + 1}
                </span>
                <span className="progress-step-copy">
                  <span className="progress-step-label">{step.label}</span>
                  <span className="progress-step-hint">
                    {showCompleted ? "Completed" : step.hint}
                  </span>
                </span>
              </button>
              <span id={descriptionId} className="sr-only">
                {showCompleted
                  ? `${step.label} is completed.`
                  : isActive
                    ? `${step.label} is the current step.`
                    : !canNavigate
                      ? step.unavailable
                      : `${step.label} is available.`}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, useAnimation, useReducedMotion } from "framer-motion";
import { LogOut } from "lucide-react";
import BrandLogo from "./BrandLogo";
import ProgressSidebar from "./ProgressSidebar";
import ShootSummary from "./ShootSummary";
import { getPlannerStepAvailability, getPlannerStepCompletion } from "../utils/validation";

/**
 * FlowShell — shared planner layout for screens 2-4.
 * Provides: top navigation bar,progress sidebar, content area, and shoot summary.
 */
export default function FlowShell({ data, onSignOut }) {
  const { pathname } = useLocation();
  const controls = useAnimation();
  const prefersReducedMotion = useReducedMotion();
  const completedSteps = getPlannerStepCompletion(data);
  const availableSteps = getPlannerStepAvailability(data);

  useEffect(() => {
    if (prefersReducedMotion) {
      controls.set({ opacity: 1, y: 0 });
      return;
    }

    controls.set({ opacity: 0, y: 12 });
    controls.start({
      opacity: 1,
      y: 0,
      transition: { duration: 0.24, ease: "easeOut" },
    });
  }, [controls, pathname, prefersReducedMotion]);

  return (
    <div className="flow-shell">
      <header className="flow-header">
        <div className="flow-header-inner">
          <BrandLogo tone="light" size={28} className="flow-header-logo" />
          <span className="flow-header-divider" aria-hidden="true" />
          <span className="flow-header-title">Shoot planner</span>
          {onSignOut && (
            <button
              type="button"
              className="flow-header-signout"
              onClick={onSignOut}
              aria-label="Sign out"
            >
              <LogOut size={18} aria-hidden="true" />
              <span className="flow-header-signout-text">Sign out</span>
            </button>
          )}
        </div>
      </header>
      <div className="flow-body">
        <div className="flow-progress" data-layout-region="progress">
          <ProgressSidebar completedSteps={completedSteps} availableSteps={availableSteps} />
        </div>
        <motion.main
          className="flow-content"
          data-layout-region="content"
          initial={false}
          animate={controls}
          data-page-motion={prefersReducedMotion ? "reduced" : "enabled"}
        >
          <Outlet />
        </motion.main>
        <div className="flow-summary" data-layout-region="summary">
          <ShootSummary data={data} />
        </div>
      </div>
    </div>
  );
}

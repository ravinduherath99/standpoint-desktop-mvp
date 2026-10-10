import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { fetchPlan } from "../utils/api";
import { formatDate, formatShootWindow } from "../lib/format";
import ActionButton from "../components/ActionButton";
import BrandLogo from "../components/BrandLogo";

export default function ConfirmationScreen({ onReset, accessToken, onAuthExpired }) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const headingRef = useRef(null);
  const unmountedRef = useRef(false);
  const reference = state?.reference ?? "";
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);
  useEffect(() => { headingRef.current?.focus(); }, []);

  useEffect(() => {
    if (!reference || !accessToken) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPlan(reference, accessToken)
      .then((resp) => {
        if (cancelled || unmountedRef.current) return;
        if (!resp || resp.reference !== reference || !resp.plan) { setError("not-found"); return; }
        setPlanData(resp);
      })
      .catch((err) => {
        if (cancelled || unmountedRef.current) return;
        if (err.message && err.message.includes("expired")) { if (onAuthExpired) onAuthExpired(); return; }
        if (err.message && err.message.includes("not found")) { setError("not-found"); return; }
        setError("failed");
      })
      .finally(() => { if (!cancelled && !unmountedRef.current) setLoading(false); });
    return () => { cancelled = true; };
  }, [reference, accessToken, onAuthExpired]);

  if (!reference) return <Navigate to="/" replace />;

  const handlePrint = () => window.print();

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    fetchPlan(reference, accessToken)
      .then((resp) => {
        if (unmountedRef.current) return;
        if (!resp || resp.reference !== reference || !resp.plan) { setError("not-found"); return; }
        setPlanData(resp);
      })
      .catch((err) => {
        if (unmountedRef.current) return;
        if (err.message && err.message.includes("expired")) { if (onAuthExpired) onAuthExpired(); return; }
        if (err.message && err.message.includes("not found")) { setError("not-found"); return; }
        setError("failed");
      })
      .finally(() => { if (!unmountedRef.current) setLoading(false); });
  };

  const handleReset = () => { onReset(); navigate("/shoot-details"); };

  if (loading) {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card confirmation-card--animate">
          <div className="confirmation-topbar">
            <BrandLogo tone="dark" size={40} className="confirmation-topbar-logo" />
          </div>
          <div className="confirmation-body">
            <p role="status" aria-live="polite">Loading your plan...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error === "not-found") {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card confirmation-card--animate">
          <div className="confirmation-topbar">
            <BrandLogo tone="dark" size={40} className="confirmation-topbar-logo" />
          </div>
          <div className="confirmation-body">
            <h1 tabIndex={-1} ref={headingRef} className="confirmation-heading">Plan not found.</h1>
            <p className="confirmation-sub">The plan could not be found or you do not have access.</p>
            <div className="confirmation-actions">
              <ActionButton onClick={handleReset}>Plan another shoot</ActionButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error === "failed") {
    return (
      <div className="confirmation-page">
        <div className="confirmation-card confirmation-card--animate">
          <div className="confirmation-topbar">
            <BrandLogo tone="dark" size={40} className="confirmation-topbar-logo" />
          </div>
          <div className="confirmation-body">
            <h1 tabIndex={-1} ref={headingRef} className="confirmation-heading">Unable to load plan.</h1>
            <p className="confirmation-sub">Something went wrong. Please try again.</p>
            <div className="confirmation-actions">
              <ActionButton onClick={handleRetry}>Retry</ActionButton>
              <ActionButton variant="secondary" onClick={handleReset}>Plan another shoot</ActionButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const p = planData?.plan || {};
  const showLighting = p.lightingPlan && typeof p.lightingPlan === "string" && p.lightingPlan.length > 0;
  const shootTypesStr = Array.isArray(p.shootTypes) ? p.shootTypes.join(", ") : "";
  const equipmentStr = Array.isArray(p.equipment) ? p.equipment.join(", ") : "";

  return (
    <div className="confirmation-page">
      <div className="confirmation-card confirmation-card--animate">
        <div className="confirmation-topbar">
          <BrandLogo tone="dark" size={40} className="confirmation-topbar-logo" />
        </div>
        <div className="confirmation-body">
          <div className="confirmation-icon" aria-hidden="true">
            <svg className="confirmation-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <polyline className="confirmation-icon-check" points="6 12 10 16 18 8" />
            </svg>
          </div>
          <span className="confirmation-kicker">Plan complete</span>
          <h1 tabIndex={-1} ref={headingRef} className="confirmation-heading">
            Shoot plan prepared.
          </h1>
          <p className="confirmation-sub">
            Your plan is saved and ready. Use the reference below to access your shoot details.
          </p>
          <div className="confirmation-info">
            <div className="confirmation-info-card">
              <div className="confirmation-info-card-label">Reference</div>
              <div className="confirmation-info-card-value confirmation-info-card-value--reference">{planData.reference}</div>
            </div>
            <div className="confirmation-info-card">
              <div className="confirmation-info-card-label">Location</div>
              <div className="confirmation-info-card-value">{p.location}</div>
            </div>
            <div className="confirmation-info-card">
              <div className="confirmation-info-card-label">Date</div>
              <div className="confirmation-info-card-value">{p.shootDate ? formatDate(p.shootDate) : ""}</div>
            </div>
          </div>
          <div className="confirmation-details">
            <h2 className="confirmation-section-title">Shoot Summary</h2>
            <dl className="confirmation-list">
              <dt>Location</dt><dd>{p.location}</dd>
              <dt>Date</dt><dd>{p.shootDate ? formatDate(p.shootDate) : ""}</dd>
              <dt>Time</dt><dd>{formatShootWindow(p.startTime, p.duration)}</dd>
              <dt>Duration</dt><dd>{p.duration}</dd>
              <dt>Shoot Type</dt><dd>{shootTypesStr}</dd>
              <dt>People</dt><dd>{p.people}</dd>
              <dt>Equipment</dt><dd>{equipmentStr}</dd>
              {showLighting && <dt>Lighting Plan</dt>}
              {showLighting && <dd>{p.lightingPlan}</dd>}
              <dt>Access Notes</dt><dd>{p.accessNotes}</dd>
            </dl>
          </div>
          <div className="confirmation-actions">
            <ActionButton variant="secondary" onClick={handlePrint}>Print shoot plan</ActionButton>
            <ActionButton onClick={handleReset}>Plan another shoot</ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

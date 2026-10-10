import { useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import FlowShell from "./components/FlowShell";
import ProtectedRoute from "./guards/ProtectedRoute";
import LoginScreen from "./pages/LoginScreen";
import ShootDetailsScreen from "./pages/ShootDetailsScreen";
import CrewEquipmentScreen from "./pages/CrewEquipmentScreen";
import AccessConsentScreen from "./pages/AccessConsentScreen";
import ConfirmationScreen from "./pages/ConfirmationScreen"
import { savePlan } from "./utils/api";
import { getPlannerStepAvailability } from "./utils/validation";
import "./styles.css";

/** Build the initial formData object with only location prefilled. */
function getInitialFormData() {
  return {
    shootDate: "",
    startTime: "",
    duration: "",
    location: "Carlton Gardens, East Lawn",
    shootTypes: [],
    people: "",
    equipment: [],
    lightingPlan: "",
    accessNotes: "",
    consent: false,
  };
}

/**
 * App — the single source of truth.
 * Owns formData and reference state.
 * Provides callbacks to every page via props.
 * Renders all five routes with guard wrappers.
 */
export default function App() {
  const [formData, setFormData] = useState(getInitialFormData);
  const [auth, setAuth] = useState({ user: null, accessToken: null });

  /** Merge one scalar field into the previous formData. */
  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  /** Add or remove one value from the named array without mutating. */
  const toggleListValue = useCallback((field, value) => {
    setFormData((prev) => {
      const list = prev[field];
      const next = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      return { ...prev, [field]: next };
    });
  }, []);

  /** Save the generated reference (confirmation screen reads from router state). */
  const preparePlan = useCallback(async () => {
    const resp = await savePlan(formData, auth.accessToken);
    if (!resp || typeof resp.reference !== "string" || !resp.reference) {
      throw new Error("Unexpected response from server.");
    }
    return resp.reference;
  }, [formData, auth.accessToken]);

  /** Restore every initial planning value — preserves auth. */
  const reset = useCallback(() => {
    setFormData(getInitialFormData());
  }, []);

  /** Handle successful authentication from LoginScreen. */
  const onLogin = useCallback((user, accessToken) => {
    setAuth({ user, accessToken });
  }, []);

  /** Sign out: clear auth and planning state. */
  const signOut = useCallback(() => {
    setAuth({ user: null, accessToken: null });
    setFormData(getInitialFormData());
  }, []);

  // Auth guard
  const isAuthenticated = auth.user !== null && auth.accessToken !== null;

  // Route prerequisites are intentionally narrower than full step completion.
  const [, canOpenCrewAndKit, canOpenAccessAndConsent] =
    getPlannerStepAvailability(formData);

  return (
    <Routes>
      {/* 1. Login — always accessible */}
      <Route
        path="/"
        element={<LoginScreen onLogin={onLogin} />}
      />

      {/* Planner screens wrapped in FlowShell (nav + sidebar + summary) */}
      <Route element={<FlowShell data={formData} onSignOut={signOut} />}>
        {/* 2. Shoot Details — requires authentication */}
        <Route
          path="/shoot-details"
          element={
            <ProtectedRoute isAllowed={isAuthenticated} redirectTo="/">
              <ShootDetailsScreen
                data={formData}
                onChange={updateField}
                onToggle={toggleListValue}
              />
            </ProtectedRoute>
          }
        />

        {/* 3. Crew & Equipment — requires a valid location */}
        <Route
          path="/crew-equipment"
          element={
            <ProtectedRoute
              isAllowed={isAuthenticated && canOpenCrewAndKit}
              redirectTo={isAuthenticated ? "/shoot-details" : "/"}
            >
              <CrewEquipmentScreen
                data={formData}
                onChange={updateField}
                onToggle={toggleListValue}
              />
            </ProtectedRoute>
          }
        />

        {/* 4. Access & Consent — requires valid location and People values */}
        <Route
          path="/access-consent"
          element={
            <ProtectedRoute
              isAllowed={isAuthenticated && canOpenAccessAndConsent}
              redirectTo={
                !isAuthenticated
                  ? "/"
                  : !canOpenCrewAndKit
                    ? "/shoot-details"
                    : "/crew-equipment"
              }
            >
              <AccessConsentScreen
                data={formData}
                onChange={updateField}
                onSubmit={preparePlan}
                onAuthExpired={signOut}
              />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 5. Confirmation — requires router state with reference */}
      <Route
        path="/confirmation"
        element={
          <ProtectedRoute isAllowed={isAuthenticated} redirectTo="/">
            <ConfirmationScreen
              data={formData}
              onReset={reset}
              accessToken={auth.accessToken}
              onAuthExpired={signOut}
            />
          </ProtectedRoute>
        }
      />

      {/* Catch-all → redirect to / */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

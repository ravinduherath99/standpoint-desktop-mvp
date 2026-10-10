/**
 * Pure validation functions — no DOM access, no side-effects.
 * Each field validator returns "" (valid) or an error message string.
 * validateForm runs all validators and returns { errors, firstInvalidField }.
 */

/* ── Individual Field Validators ──────────────────────────────────────── */

/** Validate email: required, trimmed, no spaces, exactly one @,
 *  non-empty local, domain has at least one dot, no empty labels,
 *  labels use letters/numbers/hyphens, cannot start/end with hyphen. */
export function validateEmail(value) {
  const v = value.trim();
  if (!v) return "Email is required.";
  if (/\s/.test(v)) return "Enter a valid email address.";
  const atCount = (v.match(/@/g) || []).length;
  if (atCount !== 1) return "Enter a valid email address.";
  const [local, domain] = v.split("@");
  if (!local) return "Enter a valid email address.";
  if (!domain || !domain.includes(".")) return "Enter a valid email address.";
  const labels = domain.split(".");
  for (const label of labels) {
    if (!label) return "Enter a valid email address.";
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return "Enter a valid email address.";
    if (label.startsWith("-") || label.endsWith("-"))
      return "Enter a valid email address.";
  }
  return "";
}

/** Validate password: required, at least six non-space characters. */
export function validatePassword(value) {
  if (!value) return "Password is required.";
  if (value.replace(/\s/g, "").length < 6)
    return "Password must be at least 6 non-space characters.";
  return "";
}

/** Validate location: required after trim, 3–160 characters. */
export function validateLocation(value) {
  const v = value.trim();
  if (!v) return "Location is required.";
  if (v.length < 3) return "Location must be at least 3 characters.";
  if (v.length > 160) return "Location must be 160 characters or fewer.";
  return "";
}

/** Validate shoot date: required, exact YYYY-MM-DD, real local date, today or later. */
export function validateShootDate(value) {
  if (!value) return "Shoot date is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter date in YYYY-MM-DD format.";
  const parts = value.split("-");
  const selected = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );
  if (
    isNaN(selected.getTime()) ||
    selected.getFullYear() !== Number(parts[0]) ||
    selected.getMonth() !== Number(parts[1]) - 1 ||
    selected.getDate() !== Number(parts[2])
  )
    return "Enter a valid date.";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selected < today) return "Shoot date must be today or later.";
  return "";
}

/** Validate a generic required field (start time, etc.). */
export function validateRequired(value) {
  if (!value) return "This field is required.";
  return "";
}

/** Validate people count: required, whole number 1–50. */
export function validateCrew(value) {
  const s = String(value).trim();
  if (!s) return "People count is required.";
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > 50)
    return "Enter a whole number between 1 and 50.";
  return "";
}

/** Validate trimmed text length within min–max bounds. */
export function validateTextLength(value, min, max) {
  const v = value.trim();
  if (!v) return "This field is required.";
  if (v.length < min) return `Must be at least ${min} characters.`;
  if (v.length > max) return `Must be ${max} characters or fewer.`;
  return "";
}

/** Validate lighting plan: required only when Lighting is selected; 10–200 trimmed chars. */
export function validateLightingPlan(value, lightingSelected) {
  if (!lightingSelected) return "";
  const v = value.trim();
  if (!v) return "Lighting plan is required when Lighting is selected.";
  if (v.length < 10) return "Lighting plan must be at least 10 characters.";
  if (v.length > 200) return "Lighting plan must be 200 characters or fewer.";
  return "";
}

/** Validate shoot duration against the planner's placeholder value. */
export function validateDuration(value) {
  if (!value || value === "Select duration") return "Select a duration.";
  return "";
}

/** Validate that at least one option has been selected. */
export function validateSelection(value, message = "Select at least one option.") {
  if (!Array.isArray(value) || value.length === 0) return message;
  return "";
}

/** Validate access notes using the same 20–300 character bounds as the form. */
export function validateAccessNotes(value) {
  const v = String(value || "").trim();
  if (!v) return "Access notes are required.";
  if (v.length < 20) return "Access notes must be at least 20 characters.";
  if (v.length > 300) return "Access notes must be 300 characters or fewer.";
  return "";
}

/**
 * Derive planner-step completion from the App-owned form data.
 * These checks intentionally reuse the same validators as the three forms.
 */
export function getPlannerStepCompletion(data = {}) {
  const equipment = Array.isArray(data.equipment) ? data.equipment : [];
  const lightingSelected = equipment.includes("Lighting");

  const shootDetailsComplete = [
    validateLocation(data.location || ""),
    validateShootDate(data.shootDate || ""),
    validateRequired(data.startTime || ""),
    validateDuration(data.duration || ""),
    validateSelection(data.shootTypes, "Select at least one shoot type."),
  ].every((error) => error === "");

  const crewAndKitComplete = [
    validateCrew(data.people || ""),
    validateSelection(equipment, "Select at least one equipment item."),
    equipment.includes("Drone") ? "Drone flights are not supported in this planner." : "",
    validateLightingPlan(data.lightingPlan || "", lightingSelected),
  ].every((error) => error === "");

  const accessAndConsentComplete =
    validateAccessNotes(data.accessNotes || "") === "" && data.consent === true;

  return [shootDetailsComplete, crewAndKitComplete, accessAndConsentComplete];
}

/**
 * Derive which planner destinations are available from their route
 * prerequisites without weakening full step-completion validation.
 */
export function getPlannerStepAvailability(data = {}) {
  const hasValidLocation = validateLocation(String(data.location ?? "")) === "";
  const hasValidPeople = validateCrew(data.people ?? "") === "";
  return [true, hasValidLocation, hasValidLocation && hasValidPeople];
}

/**
 * Run a map of field-name → validator-function entries.
 * Returns { errors: { field: string }, firstInvalidField: string|null }.
 * Each validator is called with no arguments and must return "" or an error string.
 */
export function validateForm(validators) {
  const errors = {};
  let firstInvalidField = null;
  for (const [field, validator] of Object.entries(validators)) {
    const error = validator();
    errors[field] = error;
    if (error && !firstInvalidField) firstInvalidField = field;
  }
  return { errors, firstInvalidField };
}

/* ── Backward-compatible helper ───────────────────────────────────────── */

/** Check whether a value looks like a structurally valid email. */
export function isValidEmail(email) {
  return validateEmail(email) === "";
}

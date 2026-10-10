import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { validateAccessNotes, validateForm } from "../utils/validation";
import FormSection from "../components/FormSection";
import FormField from "../components/FormField";
import ActionButton from "../components/ActionButton";
import FlowButton from "../components/FlowButton";

export default function AccessConsentScreen({ data, onChange, onSubmit, onAuthExpired }) {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const headingRef = useRef(null);
  const [touched, setTouched] = useState({ accessNotes: false, consent: false });
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const savingRef = useRef(false);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);
  useEffect(() => { headingRef.current?.focus(); }, []);

  const handleBlur = (field) => { setTouched((prev) => ({ ...prev, [field]: true })); };
  const accessNotesError = touched.accessNotes
    ? validateAccessNotes(data.accessNotes)
    : "";
  const consentInvalid = touched.consent && !data.consent;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    setTouched({ accessNotes: true, consent: true });
    setApiError("");

    const { firstInvalidField } = validateForm({
      accessNotes: () => validateAccessNotes(data.accessNotes),
      consent: () => !data.consent ? "You must confirm access and consent details." : "",
    });
    if (firstInvalidField) {
      requestAnimationFrame(() => {
        const el = formRef.current?.querySelector("[aria-invalid]");
        el?.focus();
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const reference = await onSubmit();
      if (unmountedRef.current) return;
      navigate("/confirmation", { state: { reference } });
      return;
    } catch (err) {
      if (unmountedRef.current) return;
      if (err?.message && err.message.includes("expired")) {
        if (onAuthExpired) onAuthExpired();
        navigate("/");
        return;
      }
      setApiError(err?.message || "Unable to save your plan. Please try again.");
    } finally {
      if (!unmountedRef.current) setSaving(false);
      savingRef.current = false;
    }
  };

  return (
    <div className="page-inner">
      <p className="page-eyebrow">Step 3 · Permissions</p>
      <h1 tabIndex={-1} ref={headingRef} className="page-title">
        Access &amp; Consent
      </h1>
      <p className="page-subtitle">
        Note how you'll get on site, then confirm you have the consents you need.
      </p>

      <form ref={formRef} className="form" onSubmit={handleSubmit} noValidate>
        <FormSection title="Site access" id="access-notes-section">
          <FormField
            label="Access notes"
            id="access-notes"
            multiline
            value={data.accessNotes}
            onChange={(e) => onChange("accessNotes", e.target.value)}
            onBlur={() => handleBlur("accessNotes")}
            helper={
              !touched.accessNotes
                ? "Describe entry points, restrictions, and site arrangements in 20–300 characters."
                : undefined
            }
            error={accessNotesError || undefined}
            maxLength={300}
            counter={{ min: 20, max: 300 }}
          />
        </FormSection>

        <FormSection title="Ethical Data Use" compact id="ethical-data">
          <div className="field consent-field">
            <label
              htmlFor="access-consent"
              className={`consent-card${data.consent ? " consent-card--checked" : ""}${consentInvalid ? " consent-card--invalid" : ""}`}
            >
              <input
                id="access-consent"
                className="consent-card-input"
                type="checkbox"
                checked={data.consent}
                onChange={(e) => {
                  onChange("consent", e.target.checked);
                  setTouched((prev) => ({ ...prev, consent: true }));
                }}
                aria-describedby={consentInvalid ? "access-consent-error" : undefined}
                aria-invalid={consentInvalid ? true : undefined}
              />
              <span className="consent-card-visual" aria-hidden="true">
                <ShieldCheck size={28} strokeWidth={2} />
              </span>
              <span className="consent-card-copy">
                <span className="consent-card-title">Access and consent confirmed</span>
                <span className="consent-card-description">
                  I confirm that I have verified access permissions and obtained
                  all necessary consents for this shoot.
                </span>
              </span>
            </label>
            {consentInvalid && (
              <span
                id="access-consent-error"
                className="field-error"
                role="alert"
              >
                You must confirm access and consent details.
              </span>
            )}
          </div>
        </FormSection>

        {apiError && (
          <div className="form-alert" role="alert">
            {apiError}
          </div>
        )}

        <div className="form-actions form-actions--split">
          <ActionButton
            variant="secondary"
            onClick={() => !saving && navigate("/crew-equipment")}
            disabled={saving}
          >
            Back
          </ActionButton>
          <FlowButton type="submit" text={saving ? "Saving..." : "Submit plan"} loading={saving} disabled={saving} />
        </div>
      </form>
    </div>
  );
}

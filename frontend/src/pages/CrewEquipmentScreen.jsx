import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Triangle,
  SunMedium,
  LampDesk,
  Drone,
  TriangleAlert,
  UsersRound,
  Wrench,
} from "lucide-react";
import {
  validateCrew,
  validateLightingPlan,
  validateSelection,
  validateForm,
} from "../utils/validation";
import FormSection from "../components/FormSection";
import FormField from "../components/FormField";
import ActionButton from "../components/ActionButton";
import FlowButton from "../components/FlowButton";
import ChoiceChips from "../components/ChoiceChips";
import NumberStepper from "../components/NumberStepper";

const EQUIPMENT = [
  { value: "Camera", icon: Camera },
  { value: "Tripod", icon: Triangle },
  { value: "Reflector", icon: SunMedium },
  { value: "Lighting", icon: LampDesk },
  { value: "Drone", icon: Drone },
];

/**
 * CrewEquipmentScreen — people count and equipment choices.
 * Back navigates to /shoot-details; Continue to /access-consent.
 * Conditional: Lighting reveals lighting plan; Drone blocks Continue.
 *
 * @param {{ data: Object, onChange: Function, onToggle: Function }} props
 */
export default function CrewEquipmentScreen({ data, onChange, onToggle }) {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const headingRef = useRef(null);
  const [touched, setTouched] = useState(/** @type {Record<string, boolean>} */ ({ people: false, equipment: false }));

  const lightingSelected = data.equipment.includes("Lighting");
  const droneSelected = data.equipment.includes("Drone");

  const peopleError = validateCrew(data.people);
  const equipmentError = validateSelection(
    data.equipment,
    "Select at least one equipment item."
  );
  const lightingPlanError = validateLightingPlan(
    data.lightingPlan,
    lightingSelected
  );

  const errors = {
    people: peopleError,
    equipment: equipmentError,
    lightingPlan: lightingPlanError,
  };

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleEquipmentToggle = (value) => {
    onToggle("equipment", value);
    setTouched((prev) => ({ ...prev, equipment: true }));

    // Lighting cleanup: when removing Lighting, clear its value and touched
    if (value === "Lighting" && data.equipment.includes("Lighting")) {
      onChange("lightingPlan", "");
      setTouched((prev) => {
        const next = { ...prev };
        delete next.lightingPlan;
        return next;
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Mark all fields touched
    const newTouched = { people: true, equipment: true };
    if (lightingSelected) newTouched.lightingPlan = true;
    setTouched(newTouched);

    // Drone blocks progression
    if (droneSelected) return;

    // Build validators for current fields
    const validators = {
      people: () => validateCrew(data.people),
      equipment: () =>
        validateSelection(data.equipment, "Select at least one equipment item."),
    };
    if (lightingSelected) {
      validators.lightingPlan = () =>
        validateLightingPlan(data.lightingPlan, true);
    }

    const { firstInvalidField } = validateForm(validators);
    if (firstInvalidField) {
      requestAnimationFrame(() => {
        const first = formRef.current?.querySelector('[aria-invalid="true"]');
        first?.focus();
      });
      return;
    }
    navigate("/access-consent");
  };

  return (
    <div className="page-inner">
      <p className="page-eyebrow">Step 2 &middot; Who and what</p>
      <h1 tabIndex={-1} ref={headingRef} className="page-title">
        Crew &amp; Kit
      </h1>
      <p className="page-subtitle">
        How many people will be on site, and what gear are you bringing?
      </p>

      <form ref={formRef} className="form" onSubmit={handleSubmit} noValidate>
        <FormSection title="Crew" icon={UsersRound} id="crew-people-section">
          <NumberStepper
            label="People on site"
            id="crew-people"
            min={1}
            max={50}
            value={data.people}
            onChange={(value) => onChange("people", value)}
            onBlur={() => handleBlur("people")}
            helper="Include yourself, assistants and anyone being photographed."
            error={touched.people && errors.people ? errors.people : undefined}
          />
        </FormSection>

        <FormSection title="Gear you'll bring" icon={Wrench} id="crew-gear-section">
          <div className="crew-equipment-gear">
            <ChoiceChips
              label="Select equipment"
              name="equipment"
              options={EQUIPMENT}
              selected={data.equipment}
              error={touched.equipment && errors.equipment ? errors.equipment : undefined}
              onToggle={handleEquipmentToggle}
              flaggedOptions={["Drone"]}
              variant="tiles"
            />
          </div>

          {lightingSelected && (
            <FormField
              label="Lighting plan"
              id="crew-lighting"
              multiline
              value={data.lightingPlan}
              onChange={(e) => onChange("lightingPlan", e.target.value)}
              onBlur={() => handleBlur("lightingPlan")}
              helper={
                !touched.lightingPlan
                  ? "Describe your lighting setup. 10–200 characters."
                  : undefined
              }
              error={
                touched.lightingPlan && errors.lightingPlan
                  ? errors.lightingPlan
                  : undefined
              }
              maxLength={200}
              counter={{ min: 10, max: 200 }}
            />
          )}

          {droneSelected && (
            <div className="drone-warning" role="status" aria-live="polite">
              <TriangleAlert className="drone-warning-icon" size={22} aria-hidden="true" />
              <div>
                <p>
                  <strong>Drone flights aren&apos;t supported in this planner.</strong>{" "}
                  Remove Drone to continue.
                </p>
                <a
                  href="https://www.casa.gov.au/drones"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Check CASA drone rules and guidance
                </a>
              </div>
            </div>
          )}
        </FormSection>

        <div className="form-actions form-actions--split">
          <ActionButton
            variant="secondary"
            onClick={() => navigate("/shoot-details")}
          >
            Back
          </ActionButton>
          <FlowButton type="submit" text="Continue" disabled={droneSelected} />
        </div>
      </form>
    </div>
  );
}

import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validateLocation,
  validateShootDate,
  validateRequired,
  validateCrew,
  validateTextLength,
  validateLightingPlan,
  getPlannerStepCompletion,
  getPlannerStepAvailability,
  validateForm,
  isValidEmail,
} from "../utils/validation";

/* ── Helpers ──────────────────────────────────────────────────────────── */

function futureDate(daysAhead = 30) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ── validateEmail ────────────────────────────────────────────────────── */

describe("validateEmail", () => {
  it("accepts a standard valid email", () => {
    expect(validateEmail("user@example.com")).toBe("");
  });

  it("accepts email with subdomain", () => {
    expect(validateEmail("user@mail.example.com")).toBe("");
  });

  it("accepts email with digits in labels", () => {
    expect(validateEmail("user123@domain456.com")).toBe("");
  });

  it("accepts email with hyphens in labels", () => {
    expect(validateEmail("user@my-domain.com")).toBe("");
  });

  it("accepts email with leading/trailing whitespace (trims)", () => {
    expect(validateEmail("  user@example.com  ")).toBe("");
  });

  it("rejects empty string", () => {
    expect(validateEmail("")).toBe("Email is required.");
  });

  it("rejects whitespace-only string", () => {
    expect(validateEmail("   ")).toBe("Email is required.");
  });

  it("rejects email with spaces", () => {
    expect(validateEmail("user @example.com")).toBe(
      "Enter a valid email address."
    );
  });

  it("rejects email with no @", () => {
    expect(validateEmail("userexample.com")).toBe(
      "Enter a valid email address."
    );
  });

  it("rejects email with multiple @", () => {
    expect(validateEmail("user@@example.com")).toBe(
      "Enter a valid email address."
    );
    expect(validateEmail("a@b@c.com")).toBe("Enter a valid email address.");
  });

  it("rejects email with empty local part", () => {
    expect(validateEmail("@example.com")).toBe(
      "Enter a valid email address."
    );
  });

  it("rejects email with no dot in domain", () => {
    expect(validateEmail("user@example")).toBe(
      "Enter a valid email address."
    );
  });

  it("rejects email with empty domain label", () => {
    expect(validateEmail("user@example..com")).toBe(
      "Enter a valid email address."
    );
  });

  it("rejects domain label starting with hyphen", () => {
    expect(validateEmail("user@-example.com")).toBe(
      "Enter a valid email address."
    );
  });

  it("rejects domain label ending with hyphen", () => {
    expect(validateEmail("user@example-.com")).toBe(
      "Enter a valid email address."
    );
  });

  it("rejects domain label with special characters", () => {
    expect(validateEmail("user@exam!ple.com")).toBe(
      "Enter a valid email address."
    );
  });

  it("rejects email with only @", () => {
    expect(validateEmail("@")).toBe("Enter a valid email address.");
  });
});

/* ── validatePassword ─────────────────────────────────────────────────── */

describe("validatePassword", () => {
  it("accepts a valid password", () => {
    expect(validatePassword("secure123")).toBe("");
  });

  it("accepts password with spaces when non-space count >= 6", () => {
    expect(validatePassword("a b c d e f")).toBe("");
  });

  it("accepts exactly 6 non-space characters", () => {
    expect(validatePassword("abcdef")).toBe("");
  });

  it("rejects empty password", () => {
    expect(validatePassword("")).toBe("Password is required.");
  });

  it("rejects fewer than 6 non-space characters", () => {
    expect(validatePassword("ab cd")).toBe(
      "Password must be at least 6 non-space characters."
    );
  });

  it("rejects 5 non-space characters", () => {
    expect(validatePassword("abcde")).toBe(
      "Password must be at least 6 non-space characters."
    );
  });
});

/* ── validateLocation ─────────────────────────────────────────────────── */

describe("validateLocation", () => {
  it("accepts a valid location", () => {
    expect(validateLocation("Carlton Gardens, East Lawn")).toBe("");
  });

  it("accepts exactly 3 characters", () => {
    expect(validateLocation("abc")).toBe("");
  });

  it("accepts exactly 160 characters", () => {
    expect(validateLocation("x".repeat(160))).toBe("");
  });

  it("rejects empty string", () => {
    expect(validateLocation("")).toBe("Location is required.");
  });

  it("rejects whitespace-only string", () => {
    expect(validateLocation("   ")).toBe("Location is required.");
  });

  it("rejects fewer than 3 characters after trim", () => {
    expect(validateLocation("ab")).toBe(
      "Location must be at least 3 characters."
    );
  });

  it("rejects more than 160 characters after trim", () => {
    expect(validateLocation("x".repeat(161))).toBe(
      "Location must be 160 characters or fewer."
    );
  });

  it("trims before counting characters", () => {
    expect(validateLocation("  ab  ")).toBe(
      "Location must be at least 3 characters."
    );
  });
});

/* ── validateShootDate ─────────────────────────────────────────────────── */

describe("validateShootDate", () => {
  it("accepts a valid future date", () => {
    expect(validateShootDate(futureDate())).toBe("");
  });

  it("accepts today date", () => {
    expect(validateShootDate(todayDate())).toBe("");
  });

  it("rejects empty string", () => {
    expect(validateShootDate("")).toBe("Shoot date is required.");
  });

  it("rejects non-YYYY-MM-DD format (slashes)", () => {
    expect(validateShootDate("2099/12/01")).toBe(
      "Enter date in YYYY-MM-DD format."
    );
  });

  it("rejects non-YYYY-MM-DD format (short month)", () => {
    expect(validateShootDate("2099-1-01")).toBe(
      "Enter date in YYYY-MM-DD format."
    );
  });

  it("rejects non-YYYY-MM-DD format (short day)", () => {
    expect(validateShootDate("2099-12-1")).toBe(
      "Enter date in YYYY-MM-DD format."
    );
  });

  it("rejects invalid calendar date Feb 30", () => {
    expect(validateShootDate("2099-02-30")).toBe("Enter a valid date.");
  });

  it("rejects invalid calendar date month 13", () => {
    expect(validateShootDate("2099-13-01")).toBe("Enter a valid date.");
  });

  it("rejects invalid calendar date day 32", () => {
    expect(validateShootDate("2099-01-32")).toBe("Enter a valid date.");
  });

  it("rejects invalid leap day 2027-02-29", () => {
    expect(validateShootDate("2027-02-29")).toBe("Enter a valid date.");
  });

  it("accepts valid leap day 2028-02-29", () => {
    expect(validateShootDate("2028-02-29")).toBe("");
  });

  it("rejects past date", () => {
    expect(validateShootDate("2000-01-01")).toBe(
      "Shoot date must be today or later."
    );
  });
});

/* ── validateRequired ─────────────────────────────────────────────────── */

describe("validateRequired", () => {
  it("accepts a non-empty string", () => {
    expect(validateRequired("16:30")).toBe("");
  });

  it("rejects empty string", () => {
    expect(validateRequired("")).toBe("This field is required.");
  });

  it("accepts the string zero", () => {
    expect(validateRequired("0")).toBe("");
  });
});

/* ── validateCrew ─────────────────────────────────────────────────────── */

describe("validateCrew", () => {
  it("accepts a valid whole number", () => {
    expect(validateCrew("4")).toBe("");
  });

  it("accepts 1 (minimum)", () => {
    expect(validateCrew("1")).toBe("");
  });

  it("accepts 50 (maximum)", () => {
    expect(validateCrew("50")).toBe("");
  });

  it("rejects empty string", () => {
    expect(validateCrew("")).toBe("People count is required.");
  });

  it("rejects zero", () => {
    expect(validateCrew("0")).toBe(
      "Enter a whole number between 1 and 50."
    );
  });

  it("rejects 51", () => {
    expect(validateCrew("51")).toBe(
      "Enter a whole number between 1 and 50."
    );
  });

  it("rejects non-integer", () => {
    expect(validateCrew("3.5")).toBe(
      "Enter a whole number between 1 and 50."
    );
  });

  it("rejects negative number", () => {
    expect(validateCrew("-1")).toBe(
      "Enter a whole number between 1 and 50."
    );
  });

  it("rejects non-numeric string", () => {
    expect(validateCrew("abc")).toBe(
      "Enter a whole number between 1 and 50."
    );
  });

  it("handles numeric input", () => {
    expect(validateCrew(4)).toBe("");
    expect(validateCrew(0)).toBe(
      "Enter a whole number between 1 and 50."
    );
  });
});

/* ── validateTextLength ────────────────────────────────────────────────── */

describe("validateTextLength", () => {
  it("accepts text within bounds", () => {
    expect(validateTextLength("This is valid text.", 10, 100)).toBe("");
  });

  it("accepts text at exact minimum", () => {
    expect(validateTextLength("1234567890", 10, 100)).toBe("");
  });

  it("accepts text at exact maximum", () => {
    expect(validateTextLength("x".repeat(100), 10, 100)).toBe("");
  });

  it("rejects empty string", () => {
    expect(validateTextLength("", 10, 100)).toBe("This field is required.");
  });

  it("rejects whitespace-only string", () => {
    expect(validateTextLength("   ", 10, 100)).toBe("This field is required.");
  });

  it("rejects text below minimum", () => {
    expect(validateTextLength("short", 10, 100)).toBe(
      "Must be at least 10 characters."
    );
  });

  it("rejects text above maximum", () => {
    expect(validateTextLength("x".repeat(101), 10, 100)).toBe(
      "Must be 100 characters or fewer."
    );
  });

  it("trims before counting", () => {
    expect(validateTextLength("  short  ", 10, 100)).toBe(
      "Must be at least 10 characters."
    );
  });

  it("works with 20-300 range (accessNotes)", () => {
    expect(
      validateTextLength(
        "Small pre-shoot session on the lower east path. Handheld kit with one reflector; no vehicle access required.",
        20,
        300
      )
    ).toBe("");
  });
});

/* ── validateLightingPlan ─────────────────────────────────────────────── */

describe("validateLightingPlan", () => {
  it("returns empty when Lighting is not selected", () => {
    expect(validateLightingPlan("", false)).toBe("");
    expect(validateLightingPlan("anything", false)).toBe("");
  });

  it("accepts valid plan when Lighting is selected", () => {
    expect(validateLightingPlan("Two softboxes and a key light", true)).toBe(
      ""
    );
  });

  it("accepts exactly 10 characters", () => {
    expect(validateLightingPlan("1234567890", true)).toBe("");
  });

  it("accepts exactly 200 characters", () => {
    expect(validateLightingPlan("x".repeat(200), true)).toBe("");
  });

  it("rejects empty value when Lighting is selected", () => {
    expect(validateLightingPlan("", true)).toBe(
      "Lighting plan is required when Lighting is selected."
    );
  });

  it("rejects whitespace-only value when Lighting is selected", () => {
    expect(validateLightingPlan("   ", true)).toBe(
      "Lighting plan is required when Lighting is selected."
    );
  });

  it("rejects fewer than 10 characters", () => {
    expect(validateLightingPlan("short", true)).toBe(
      "Lighting plan must be at least 10 characters."
    );
  });

  it("rejects more than 200 characters", () => {
    expect(validateLightingPlan("x".repeat(201), true)).toBe(
      "Lighting plan must be 200 characters or fewer."
    );
  });
});

/* ── validateForm ─────────────────────────────────────────────────────── */

describe("validateForm", () => {
  it("returns empty errors when all validators pass", () => {
    const { errors, firstInvalidField } = validateForm({
      a: () => "",
      b: () => "",
    });
    expect(errors).toEqual({ a: "", b: "" });
    expect(firstInvalidField).toBeNull();
  });

  it("returns first invalid field name", () => {
    const { errors, firstInvalidField } = validateForm({
      alpha: () => "err",
      beta: () => "",
    });
    expect(errors.alpha).toBe("err");
    expect(errors.beta).toBe("");
    expect(firstInvalidField).toBe("alpha");
  });

  it("returns first invalid when multiple are invalid", () => {
    const { firstInvalidField } = validateForm({
      people: () => "err1",
      equipment: () => "err2",
    });
    expect(firstInvalidField).toBe("people");
  });

  it("returns empty object for no validators", () => {
    const { errors, firstInvalidField } = validateForm({});
    expect(errors).toEqual({});
    expect(firstInvalidField).toBeNull();
  });
});

/* ── planner step completion ───────────────────────────────────────────── */

describe("getPlannerStepCompletion", () => {
  const completeData = () => ({
    location: "Carlton Gardens",
    shootDate: futureDate(),
    startTime: "09:30",
    duration: "90 minutes",
    shootTypes: ["Portrait"],
    people: "4",
    equipment: ["Camera", "Lighting"],
    lightingPlan: "Two softboxes near the east-facing windows.",
    accessNotes: "Enter through the south gate after checking in with security.",
    consent: true,
  });

  it("marks all steps complete when every existing validation rule passes", () => {
    expect(getPlannerStepCompletion(completeData())).toEqual([true, true, true]);
  });

  it.each([
    ["location", "x"],
    ["shootDate", "2020-01-01"],
    ["startTime", ""],
    ["duration", "Select duration"],
    ["shootTypes", []],
  ])("keeps Shoot Details incomplete when %s is invalid", (field, value) => {
    expect(getPlannerStepCompletion({ ...completeData(), [field]: value })[0]).toBe(false);
  });

  it.each([
    ["people", "0"],
    ["people", "2.5"],
    ["equipment", []],
    ["equipment", ["Camera", "Drone"]],
  ])("keeps Crew and Kit incomplete when %s is invalid", (field, value) => {
    expect(getPlannerStepCompletion({ ...completeData(), [field]: value })[1]).toBe(false);
  });

  it("requires valid lighting notes only when Lighting is selected", () => {
    expect(getPlannerStepCompletion({ ...completeData(), lightingPlan: "short" })[1]).toBe(false);
    expect(
      getPlannerStepCompletion({
        ...completeData(),
        equipment: ["Camera"],
        lightingPlan: "",
      })[1]
    ).toBe(true);
  });

  it("requires valid access notes and checked consent", () => {
    expect(getPlannerStepCompletion({ ...completeData(), accessNotes: "Too short" })[2]).toBe(false);
    expect(getPlannerStepCompletion({ ...completeData(), consent: false })[2]).toBe(false);
    expect(getPlannerStepCompletion({ ...completeData(), accessNotes: "x".repeat(301) })[2]).toBe(false);
  });
});

describe("getPlannerStepAvailability", () => {
  it("always exposes Shoot Details and opens Crew & Kit with only a valid location", () => {
    expect(getPlannerStepAvailability({})).toEqual([true, false, false]);
    expect(getPlannerStepAvailability({ location: "Carlton Gardens" })).toEqual([
      true,
      true,
      false,
    ]);
  });

  it.each(["", "  ", "x", "x".repeat(161)])(
    "keeps Crew & Kit unavailable when location %j is invalid",
    (location) => {
      expect(getPlannerStepAvailability({ location, people: "4" })).toEqual([true, false, false]);
    }
  );

  it("opens Access & Consent with valid location and People despite incomplete forms", () => {
    const incompleteData = {
      location: "Carlton Gardens",
      shootDate: "",
      startTime: "",
      duration: "",
      shootTypes: [],
      people: "4",
      equipment: [],
    };

    expect(getPlannerStepAvailability(incompleteData)).toEqual([true, true, true]);
    expect(getPlannerStepCompletion(incompleteData)).toEqual([false, false, false]);
  });

  it.each(["", "0", "51", "2.5", "many"])(
    "keeps Access & Consent unavailable when People %j is invalid",
    (people) => {
      expect(getPlannerStepAvailability({ location: "Carlton Gardens", people })).toEqual([
        true,
        true,
        false,
      ]);
    }
  );

  it("does not use equipment rules as route prerequisites", () => {
    expect(getPlannerStepAvailability({
      location: "Carlton Gardens",
      people: "4",
      equipment: ["Drone"],
    })).toEqual([true, true, true]);
  });
});

/* ── isValidEmail (backward-compat helper) ─────────────────────────────── */

describe("isValidEmail", () => {
  it("accepts valid email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("rejects email without @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("trims whitespace before checking", () => {
    expect(isValidEmail("  user@example.com  ")).toBe(true);
  });

  it("rejects email with domain starting with hyphen", () => {
    expect(isValidEmail("user@-example.com")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Test the App-level callbacks in isolation by simulating
 * the same patterns App.jsx uses.
 */
import { useState, useCallback } from "react";

/** Minimal test harness that mirrors App's state management. */
function TestHarness({ initialData }) {
  const [formData, setFormData] = useState(initialData);
  const [reference, setReference] = useState("");

  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleListValue = useCallback((field, value) => {
    setFormData((prev) => {
      const list = prev[field];
      const next = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      return { ...prev, [field]: next };
    });
  }, []);

  const preparePlan = useCallback((ref) => {
    setReference(ref);
  }, []);

  const reset = useCallback(() => {
    setFormData(initialData);
    setReference("");
  }, [initialData]);

  return (
    <div>
      <span data-testid="email">{formData.email}</span>
      <span data-testid="location">{formData.location}</span>
      <span data-testid="types">{formData.shootTypes.join(",")}</span>
      <span data-testid="equipment">{formData.equipment.join(",")}</span>
      <span data-testid="consent">{String(formData.consent)}</span>
      <span data-testid="reference">{reference}</span>
      <button onClick={() => updateField("email", "test@example.com")}>
        Set email
      </button>
      <button onClick={() => updateField("consent", true)}>
        Set consent
      </button>
      <button onClick={() => toggleListValue("shootTypes", "Wedding")}>
        Toggle Wedding
      </button>
      <button onClick={() => toggleListValue("shootTypes", "Pre-shoot")}>
        Toggle Pre-shoot
      </button>
      <button onClick={() => toggleListValue("equipment", "Drone")}>
        Toggle Drone
      </button>
      <button onClick={() => toggleListValue("equipment", "Camera")}>
        Toggle Camera
      </button>
      <button onClick={() => preparePlan("SP-123456")}>
        Prepare plan
      </button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}

const INITIAL = {
  email: "",
  password: "",
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

describe("App state flow (via TestHarness)", () => {
  it("updateField merges a scalar field", async () => {
    const user = userEvent.setup();
    render(<TestHarness initialData={INITIAL} />);
    expect(screen.getByTestId("email")).toHaveTextContent("");
    await user.click(screen.getByText("Set email"));
    expect(screen.getByTestId("email")).toHaveTextContent("test@example.com");
  });

  it("updateField merges consent boolean", async () => {
    const user = userEvent.setup();
    render(<TestHarness initialData={INITIAL} />);
    expect(screen.getByTestId("consent")).toHaveTextContent("false");
    await user.click(screen.getByText("Set consent"));
    expect(screen.getByTestId("consent")).toHaveTextContent("true");
  });

  it("toggleListValue adds value not already in array", async () => {
    const user = userEvent.setup();
    render(<TestHarness initialData={INITIAL} />);
    expect(screen.getByTestId("types")).toHaveTextContent("");
    await user.click(screen.getByText("Toggle Wedding"));
    expect(screen.getByTestId("types")).toHaveTextContent("Wedding");
  });

  it("toggleListValue removes value already in array", async () => {
    const user = userEvent.setup();
    render(<TestHarness initialData={INITIAL} />);
    // First add Wedding
    await user.click(screen.getByText("Toggle Wedding"));
    expect(screen.getByTestId("types")).toHaveTextContent("Wedding");
    // Then remove it
    await user.click(screen.getByText("Toggle Wedding"));
    expect(screen.getByTestId("types")).toHaveTextContent("");
  });

  it("toggleListValue adds equipment not in array", async () => {
    const user = userEvent.setup();
    render(<TestHarness initialData={INITIAL} />);
    await user.click(screen.getByText("Toggle Drone"));
    expect(screen.getByTestId("equipment")).toHaveTextContent("Drone");
  });

  it("toggleListValue removes equipment in array", async () => {
    const user = userEvent.setup();
    render(<TestHarness initialData={INITIAL} />);
    // First add Camera
    await user.click(screen.getByText("Toggle Camera"));
    expect(screen.getByTestId("equipment")).toHaveTextContent("Camera");
    // Then remove it
    await user.click(screen.getByText("Toggle Camera"));
    expect(screen.getByTestId("equipment")).toHaveTextContent("");
  });

  it("preparePlan saves the reference string", async () => {
    const user = userEvent.setup();
    render(<TestHarness initialData={INITIAL} />);
    expect(screen.getByTestId("reference")).toHaveTextContent("");
    await user.click(screen.getByText("Prepare plan"));
    expect(screen.getByTestId("reference")).toHaveTextContent("SP-123456");
  });

  it("reset restores initial values and clears reference", async () => {
    const user = userEvent.setup();
    render(<TestHarness initialData={INITIAL} />);
    // Change some values
    await user.click(screen.getByText("Set email"));
    await user.click(screen.getByText("Prepare plan"));
    expect(screen.getByTestId("email")).toHaveTextContent("test@example.com");
    expect(screen.getByTestId("reference")).toHaveTextContent("SP-123456");
    // Reset
    await user.click(screen.getByText("Reset"));
    expect(screen.getByTestId("email")).toHaveTextContent("");
    expect(screen.getByTestId("reference")).toHaveTextContent("");
    expect(screen.getByTestId("types")).toHaveTextContent("");
    expect(screen.getByTestId("location")).toHaveTextContent("Carlton Gardens, East Lawn");
  });
});

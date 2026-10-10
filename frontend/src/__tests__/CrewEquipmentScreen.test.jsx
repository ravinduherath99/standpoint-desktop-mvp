import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CrewEquipmentScreen from "../pages/CrewEquipmentScreen";

const VALID_DATA = {
  people: "4",
  equipment: ["Camera"],
  lightingPlan: "",
};

function renderScreen({ data = VALID_DATA, onChange = vi.fn(), onToggle = vi.fn() } = {}) {
  return {
    onChange,
    onToggle,
    ...render(
      <MemoryRouter initialEntries={["/crew-equipment"]}>
        <Routes>
          <Route
            path="/crew-equipment"
            element={<CrewEquipmentScreen data={data} onChange={onChange} onToggle={onToggle} />}
          />
          <Route path="/shoot-details" element={<div>Shoot destination</div>} />
          <Route path="/access-consent" element={<div>Access destination</div>} />
        </Routes>
      </MemoryRouter>
    ),
  };
}

describe("CrewEquipmentScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback) => setTimeout(callback, 0));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the revised header and semantic Crew and Kit sections", () => {
    const { container } = renderScreen();

    expect(screen.getByText("Step 2 · Who and what")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Crew & Kit" })).toHaveFocus();
    expect(screen.getByText("How many people will be on site, and what gear are you bringing?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Crew" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Gear you'll bring" })).toBeInTheDocument();
    expect(screen.getByText("Include yourself, assistants and anyone being photographed.")).toBeInTheDocument();
    expect(container.querySelector(".crew-equipment-gear")).toBeInTheDocument();

    const actions = container.querySelector(".form-actions--split");
    expect(container.querySelectorAll(".form-actions")).toHaveLength(1);
    expect([...actions.querySelectorAll("button")].map((button) => button.textContent.trim())).toEqual([
      "Back",
      "Continue",
    ]);
  });

  it("preserves the empty people value and controlled callback contract", async () => {
    const user = userEvent.setup();
    const { onChange } = renderScreen({ data: { ...VALID_DATA, people: "" } });
    const input = screen.getByLabelText("People on site");

    expect(input).toHaveValue(null);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Increase people on site" }));
    expect(onChange).toHaveBeenCalledWith("people", "1");

    fireEvent.change(input, { target: { value: "7" } });
    expect(onChange).toHaveBeenLastCalledWith("people", "7");
  });

  it("renders five icon-backed gear tiles with existing values", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderScreen();

    for (const name of ["Camera", "Tripod", "Reflector", "Lighting", "Drone"]) {
      const tile = screen.getByRole("button", { name });
      expect(tile.querySelector(".choice-chip-icon")).toHaveAttribute("aria-hidden", "true");
    }

    expect(screen.getByRole("button", { name: "Camera" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Drone" })).toHaveClass("choice-chip--flagged");
    expect(screen.getByRole("button", { name: "Tripod" }).querySelector("svg")).toHaveClass("lucide-triangle");
    expect(screen.getByRole("button", { name: "Drone" }).querySelector("svg")).toHaveClass("lucide-drone");

    await user.click(screen.getByRole("button", { name: "Tripod" }));
    expect(onToggle).toHaveBeenCalledWith("equipment", "Tripod");
  });

  it("shows lighting notes with a 10–200 counter and preserves cleanup", async () => {
    const user = userEvent.setup();
    const { onChange, onToggle } = renderScreen({
      data: {
        ...VALID_DATA,
        equipment: ["Camera", "Lighting"],
        lightingPlan: "Two softboxes",
      },
    });
    const lightingPlan = screen.getByLabelText("Lighting plan");

    expect(lightingPlan).toHaveAttribute("maxlength", "200");
    expect(lightingPlan).toHaveAttribute("aria-describedby", expect.stringContaining("crew-lighting-counter"));
    expect(screen.getByText("13 / 200")).toBeInTheDocument();

    fireEvent.change(lightingPlan, { target: { value: "Three softboxes" } });
    expect(onChange).toHaveBeenCalledWith("lightingPlan", "Three softboxes");

    await user.click(screen.getByRole("button", { name: "Lighting" }));
    expect(onToggle).toHaveBeenCalledWith("equipment", "Lighting");
    expect(onChange).toHaveBeenCalledWith("lightingPlan", "");
  });

  it("shows accurate Drone guidance and blocks Continue", () => {
    renderScreen({ data: { ...VALID_DATA, equipment: ["Camera", "Drone"] } });

    const warning = screen.getByRole("status");
    const link = screen.getByRole("link", { name: "Check CASA drone rules and guidance" });

    expect(warning).toHaveTextContent("Drone flights aren't supported in this planner.");
    expect(warning).toHaveTextContent("Remove Drone to continue.");
    expect(warning.querySelector(".drone-warning-icon")).toHaveAttribute("aria-hidden", "true");
    expect(link).toHaveAttribute("href", "https://www.casa.gov.au/drones");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("focuses the people input when it is first invalid", async () => {
    const user = userEvent.setup();
    renderScreen({ data: { ...VALID_DATA, people: "" } });

    await user.click(screen.getByRole("button", { name: "Continue" }));

    const input = screen.getByLabelText("People on site");
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("People count is required.");
  });

  it("focuses the first gear tile when equipment is first invalid", async () => {
    const user = userEvent.setup();
    renderScreen({ data: { ...VALID_DATA, equipment: [] } });

    await user.click(screen.getByRole("button", { name: "Continue" }));

    const firstTile = screen.getByRole("button", { name: "Camera" });
    await waitFor(() => expect(firstTile).toHaveFocus());
    expect(firstTile).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Select at least one equipment item.");
  });

  it("validates and focuses lighting notes only when Lighting is selected", async () => {
    const user = userEvent.setup();
    renderScreen({
      data: { ...VALID_DATA, equipment: ["Camera", "Lighting"], lightingPlan: "short" },
    });

    await user.click(screen.getByRole("button", { name: "Continue" }));

    const lightingPlan = screen.getByLabelText("Lighting plan");
    await waitFor(() => expect(lightingPlan).toHaveFocus());
    expect(lightingPlan).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Lighting plan must be at least 10 characters.");
  });

  it("preserves Back and valid Continue navigation", async () => {
    const user = userEvent.setup();
    const firstRender = renderScreen();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Shoot destination")).toBeInTheDocument();
    firstRender.unmount();

    renderScreen();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Access destination")).toBeInTheDocument();
  });
});

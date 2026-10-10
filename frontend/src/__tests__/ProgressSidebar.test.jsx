import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import ProgressSidebar from "../components/ProgressSidebar";

function CurrentRoute() {
  return <span data-testid="current-route">{useLocation().pathname}</span>;
}

function renderSidebar(
  path = "/crew-equipment",
  completedSteps = [true, false, false],
  availableSteps = [true, true, false]
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProgressSidebar completedSteps={completedSteps} availableSteps={availableSteps} />
      <CurrentRoute />
    </MemoryRouter>
  );
}

describe("ProgressSidebar", () => {
  it("renders labels, hints, compact current-step text and progress semantics", () => {
    renderSidebar("/shoot-details", [false, false, false]);

    expect(screen.getByRole("navigation", { name: "Planning progress" })).toBeInTheDocument();
    expect(screen.getByText("Where and when")).toBeInTheDocument();
    expect(screen.getByText("Who and what")).toBeInTheDocument();
    expect(screen.getByText("Permissions")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Planner step progress" })).toHaveAttribute(
      "aria-valuenow",
      "1"
    );
  });

  it("marks the active step and describes completed steps for screen readers", () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: /Crew & Kit/i })).toHaveAttribute(
      "aria-current",
      "step"
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Shoot Details is completed.")).toHaveClass("sr-only");
  });

  it("navigates to a completed step", async () => {
    renderSidebar();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Shoot Details/i }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/shoot-details");
  });

  it("explains unavailable future steps and preserves route prerequisites", async () => {
    renderSidebar("/shoot-details", [false, false, false], [true, false, false]);
    const user = userEvent.setup();
    const crewButton = screen.getByRole("button", { name: /Crew & Kit/i });

    expect(crewButton).toHaveAttribute("aria-disabled", "true");
    const explanation = screen.getByText(/Enter a valid location before opening Crew & Kit/i);
    expect(explanation).toHaveClass("sr-only");
    expect(crewButton).toHaveAttribute("aria-describedby", explanation.id);
    await user.click(crewButton);
    expect(screen.getByTestId("current-route")).toHaveTextContent("/shoot-details");
  });

  it("allows Crew & Kit with a valid location even when Shoot Details is incomplete", async () => {
    renderSidebar("/shoot-details", [false, false, false], [true, true, false]);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Crew & Kit/i }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/crew-equipment");
  });

  it("keeps Access & Consent unavailable until People is valid and explains both prerequisites", async () => {
    renderSidebar("/crew-equipment", [false, false, false], [true, true, false]);
    const user = userEvent.setup();
    const accessButton = screen.getByRole("button", { name: /Access & Consent/i });
    const explanation = screen.getByText(/valid location and People value/i);

    expect(accessButton).toHaveAttribute("aria-disabled", "true");
    expect(accessButton).toHaveAttribute("aria-describedby", explanation.id);
    await user.click(accessButton);
    expect(screen.getByTestId("current-route")).toHaveTextContent("/crew-equipment");
  });

  it("allows Access & Consent when its prerequisites are available without completed steps", async () => {
    renderSidebar("/crew-equipment", [false, false, false], [true, true, true]);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Access & Consent/i }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/access-consent");
  });
});

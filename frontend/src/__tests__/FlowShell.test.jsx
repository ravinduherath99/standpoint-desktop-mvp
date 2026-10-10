import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

const motionState = vi.hoisted(() => ({
  reduced: false,
  set: vi.fn(),
  start: vi.fn(),
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const motionComponent = (tag) => React.forwardRef(function MockMotionComponent(
    { children, animate: _animate, initial: _initial, transition: _transition, ...props },
    ref
  ) {
    return React.createElement(tag, { ...props, ref }, children);
  });
  return {
    motion: {
      main: motionComponent("main"),
      span: motionComponent("span"),
      circle: motionComponent("circle"),
    },
    useAnimation: () => ({ set: motionState.set, start: motionState.start }),
    useReducedMotion: () => motionState.reduced,
  };
});

import FlowShell from "../components/FlowShell";

const DATA = {
  location: "Carlton Gardens",
  shootDate: "2099-06-20",
  startTime: "09:30",
  duration: "90 minutes",
  shootTypes: ["Portrait"],
  people: "4",
  equipment: ["Camera"],
  lightingPlan: "",
  accessNotes: "",
  consent: false,
};

function FirstStep() {
  const navigate = useNavigate();
  return (
    <div>
      <span data-testid="saved-location">{DATA.location}</span>
      <button type="button" onClick={() => navigate("/crew-equipment")}>Next route</button>
    </div>
  );
}

function renderShell(path = "/shoot-details") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<FlowShell data={DATA} />}>
          <Route path="/shoot-details" element={<FirstStep />} />
          <Route path="/crew-equipment" element={<div>Crew route</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("FlowShell", () => {
  beforeEach(() => {
    motionState.reduced = false;
    motionState.set.mockReset();
    motionState.start.mockReset();
  });

  it("animates page entry from 12px below without creating form state", async () => {
    renderShell();

    await waitFor(() => {
      expect(motionState.set).toHaveBeenCalledWith({ opacity: 0, y: 12 });
      expect(motionState.start).toHaveBeenCalledWith(
        expect.objectContaining({ opacity: 1, y: 0 })
      );
    });
    expect(screen.getByTestId("saved-location")).toHaveTextContent("Carlton Gardens");
  });

  it("skips entry animation when reduced motion is preferred", async () => {
    motionState.reduced = true;
    renderShell();

    await waitFor(() => {
      expect(motionState.set).toHaveBeenCalledWith({ opacity: 1, y: 0 });
    });
    expect(motionState.start).not.toHaveBeenCalled();
    expect(document.querySelector(".flow-content")).toHaveAttribute("data-page-motion", "reduced");
  });

  it("keeps App-owned data intact while navigating between planner routes", async () => {
    renderShell();
    const user = userEvent.setup();

    expect(screen.getByTestId("saved-location")).toHaveTextContent("Carlton Gardens");
    await user.click(screen.getByRole("button", { name: "Next route" }));
    expect(await screen.findByText("Crew route")).toBeInTheDocument();
  });

  it("keeps one progress, content and summary region in logical DOM order", () => {
    const { container } = renderShell();
    const regions = [...container.querySelectorAll("[data-layout-region]")];

    expect(regions).toHaveLength(3);
    expect(regions.map((region) => region.dataset.layoutRegion)).toEqual([
      "progress",
      "content",
      "summary",
    ]);
    expect(screen.getAllByLabelText("Planning progress")).toHaveLength(1);
    expect(screen.getAllByLabelText("Live shoot summary")).toHaveLength(1);
  });
});

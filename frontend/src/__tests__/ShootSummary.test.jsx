import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const motionState = vi.hoisted(() => ({ reduced: false }));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const motionComponent = (tag) => React.forwardRef(function MockMotionComponent(
    { children, animate, initial: _initial, transition, ...props },
    ref
  ) {
    return React.createElement(tag, {
      ...props,
      ref,
      "data-animate": JSON.stringify(animate),
      "data-transition": JSON.stringify(transition),
    }, children);
  });
  return {
    motion: {
      span: motionComponent("span"),
      circle: motionComponent("circle"),
    },
    useReducedMotion: () => motionState.reduced,
  };
});

import ShootSummary from "../components/ShootSummary";

function makeData(overrides = {}) {
  return {
    location: "Carlton Gardens, East Lawn",
    shootDate: "",
    startTime: "",
    duration: "",
    shootTypes: [],
    people: "",
    equipment: [],
    ...overrides,
  };
}

function installMatchMedia(matches) {
  const listeners = new Set();
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((event, listener) => {
      if (event === "change") listeners.add(listener);
    }),
    removeEventListener: vi.fn((event, listener) => {
      if (event === "change") listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  delete window.matchMedia;
});

beforeEach(() => {
  motionState.reduced = false;
});

describe("ShootSummary", () => {
  it("preserves its accessible label, live label, and lazy location image", () => {
    render(<ShootSummary data={makeData()} />);
    expect(screen.getByRole("complementary", { name: "Live shoot summary" })).toBeInTheDocument();
    expect(screen.getByText("LIVE SUMMARY")).toBeInTheDocument();
    const image = screen.getByAltText("Carlton Gardens location preview");
    expect(image).toHaveAttribute("loading", "lazy");
  });

  it("renders the App-owned location as the heading", () => {
    render(<ShootSummary data={makeData()} />);
    expect(screen.getByRole("heading", { name: "Carlton Gardens, East Lawn" })).toBeInTheDocument();
  });

  it("renders all six labelled icon cells with accessible empty values", () => {
    const { container } = render(<ShootSummary data={makeData({ location: "" })} />);
    for (const label of ["Date", "Time", "Duration", "Shoot type", "People", "Equipment"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    const cells = container.querySelectorAll(".shoot-summary-cell");
    expect(cells).toHaveLength(6);
    cells.forEach((cell) => {
      expect(cell.querySelector("dt svg")).toBeInTheDocument();
      expect(cell.querySelector("dd")).toHaveTextContent("—");
      expect(cell.querySelector("dd")).toHaveClass("shoot-summary-value--empty");
      expect(cell.querySelector("dd")).toHaveAttribute("aria-live", "polite");
    });
    expect(screen.queryByText(/not set|select duration/i)).not.toBeInTheDocument();
  });

  it("shows progressive values and a calculated end time", () => {
    render(
      <ShootSummary
        data={makeData({
          shootDate: "2099-06-15",
          startTime: "16:30",
          duration: "2 hours",
          shootTypes: ["Wedding", "Portrait"],
          people: "4",
          equipment: ["Camera", "Drone"],
        })}
      />
    );
    expect(screen.getByText("Mon 15 Jun 2099")).toBeInTheDocument();
    expect(screen.getByText("4:30 pm–6:30 pm")).toBeInTheDocument();
    expect(screen.getByText("2 hours")).toBeInTheDocument();
    expect(screen.getByText("Wedding, Portrait")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Camera, Drone")).toBeInTheDocument();
  });

  it("makes a calculated cross-midnight end time explicit", () => {
    render(<ShootSummary data={makeData({ startTime: "23:30", duration: "90 minutes" })} />);
    expect(screen.getByText("11:30 pm–1:00 am (+1 day)")).toBeInTheDocument();
  });

  it("counts readiness from the six detail groups and not location", () => {
    const { rerender } = render(<ShootSummary data={makeData()} />);
    expect(screen.getByRole("img", { name: "0 of 6 details filled" })).toBeInTheDocument();

    rerender(<ShootSummary data={makeData({ shootDate: "2099-06-15", people: "3" })} />);
    expect(screen.getByRole("img", { name: "2 of 6 details filled" })).toBeInTheDocument();

    rerender(
      <ShootSummary
        data={makeData({
          shootDate: "2099-06-15",
          startTime: "16:30",
          duration: "2 hours",
          shootTypes: ["Portrait"],
          people: "3",
          equipment: ["Camera"],
        })}
      />
    );
    expect(screen.getByRole("img", { name: "6 of 6 details filled" })).toBeInTheDocument();
    expect(document.querySelector(".shoot-summary-readiness-progress")).toHaveAttribute(
      "data-motion",
      "spring"
    );
  });

  it("uses the label pseudo-element as the only live status indicator", () => {
    render(<ShootSummary data={makeData()} />);
    const label = document.querySelector(".shoot-summary-label");

    expect(label).toHaveTextContent("LIVE SUMMARY");
    expect(label.children).toHaveLength(0);
    expect(document.querySelector(".shoot-summary-live-indicator")).not.toBeInTheDocument();
    expect(document.querySelector(".shoot-summary-live-dot")).not.toBeInTheDocument();
  });

  it("keeps the Framer Motion readiness indicator static under reduced motion", () => {
    motionState.reduced = true;
    render(<ShootSummary data={makeData()} />);
    expect(document.querySelector(".shoot-summary-label")).toBeInTheDocument();
    expect(document.querySelector(".shoot-summary-readiness-progress")).toHaveAttribute(
      "data-motion",
      "reduced"
    );
  });

  it("waits for a complete calculable window before showing the fixed-location light estimate", () => {
    const { rerender } = render(
      <ShootSummary data={makeData({ shootDate: "2026-10-24", startTime: "06:10" })} />
    );
    expect(screen.queryByText("Golden light")).not.toBeInTheDocument();
    expect(screen.queryByText(/Based on Carlton Gardens, Melbourne/i)).not.toBeInTheDocument();

    rerender(
      <ShootSummary
        data={makeData({ shootDate: "2026-10-24", startTime: "06:10", duration: "60 minutes" })}
      />
    );
    expect(screen.getByText("Golden light")).toBeInTheDocument();
    expect(screen.getByText("Based on Carlton Gardens, Melbourne")).toBeInTheDocument();
  });

  it("uses a native, labelled disclosure for details below 900px", async () => {
    installMatchMedia(true);
    const user = userEvent.setup();
    const { container } = render(<ShootSummary data={makeData()} />);
    const button = screen.getByRole("button", { name: "Show details" });
    const grid = container.querySelector(".shoot-summary-grid");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", grid.id);
    expect(grid).toHaveAttribute("hidden");

    await user.click(button);
    expect(screen.getByRole("button", { name: "Hide details" })).toHaveAttribute("aria-expanded", "true");
    expect(grid).not.toHaveAttribute("hidden");
    expect(screen.getByText("Date")).toBeInTheDocument();
  });

  it("keeps the detail grid exposed at desktop widths", () => {
    installMatchMedia(false);
    const { container } = render(<ShootSummary data={makeData()} />);
    expect(container.querySelector(".shoot-summary-grid")).not.toHaveAttribute("hidden");
    expect(screen.getByRole("button", { name: "Show details" })).toHaveAttribute("aria-expanded", "true");
  });
});
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ShootDetailsScreen from "../pages/ShootDetailsScreen";

const VALID_DATA = {
  location: "Carlton Gardens, East Lawn",
  shootDate: "2099-06-20",
  startTime: "09:30",
  duration: "90 minutes",
  shootTypes: ["Portrait"],
};

function installBrowserMocks() {
  global.ResizeObserver = vi.fn(function ResizeObserver() {
    this.observe = vi.fn();
    this.disconnect = vi.fn();
  });
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("requestAnimationFrame", (callback) => setTimeout(callback, 0));
}

function renderScreen({ data = VALID_DATA, onChange = vi.fn(), onToggle = vi.fn() } = {}) {
  return {
    onChange,
    onToggle,
    ...render(
      <MemoryRouter initialEntries={["/shoot-details"]}>
        <Routes>
          <Route
            path="/shoot-details"
            element={<ShootDetailsScreen data={data} onChange={onChange} onToggle={onToggle} />}
          />
          <Route path="/crew-equipment" element={<div>Crew destination</div>} />
        </Routes>
      </MemoryRouter>
    ),
  };
}

describe("ShootDetailsScreen", () => {
  beforeEach(() => installBrowserMocks());

  afterEach(() => {
    vi.unstubAllGlobals();
    delete global.ResizeObserver;
  });

  it("renders the revised header and three form sections", () => {
    const { container } = renderScreen();

    expect(screen.getByText("Step 1 · Where and when")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Shoot Details" })).toHaveFocus();
    expect(screen.getByText("Pick the spot and the time. The light preview shows how your slot sits against sunset.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Where you're shooting" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "When" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Shoot type" })).toBeInTheDocument();
    expect(container.querySelector(".shoot-details-date-time")).toBeInTheDocument();
    expect(container.querySelectorAll(".form-actions")).toHaveLength(1);
    expect(container.querySelector(".form-actions")).toContainElement(
      screen.getByRole("button", { name: "Continue" })
    );
  });

  it("preserves controlled field callbacks and 15-minute time steps", async () => {
    const user = userEvent.setup();
    const { onChange, onToggle } = renderScreen();

    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Royal Park" } });
    expect(onChange).toHaveBeenCalledWith("location", "Royal Park");

    fireEvent.change(screen.getByLabelText("Shoot date"), { target: { value: "2099-06-21" } });
    expect(onChange).toHaveBeenCalledWith("shootDate", "2099-06-21");

    const time = screen.getByLabelText("Start time");
    expect(time).toHaveAttribute("step", "900");
    fireEvent.change(time, { target: { value: "10:15" } });
    expect(onChange).toHaveBeenCalledWith("startTime", "10:15");

    await user.click(screen.getByText("2 hr"));
    expect(onChange).toHaveBeenCalledWith("duration", "2 hours");

    await user.click(screen.getByRole("button", { name: "Wedding" }));
    expect(onToggle).toHaveBeenCalledWith("shootTypes", "Wedding");
  });

  it("renders icon tiles and keeps selected state visible and semantic", () => {
    renderScreen();
    const portrait = screen.getByRole("button", { name: "Portrait" });

    expect(portrait).toHaveAttribute("aria-pressed", "true");
    expect(portrait).toHaveClass("choice-chip--selected");
    expect(portrait.querySelector(".choice-chip-icon")).toHaveAttribute("aria-hidden", "true");
    expect(portrait.querySelector(".choice-chip-check")).toBeInTheDocument();
  });

  it("shows the specific start-time error and focuses the time input", async () => {
    const user = userEvent.setup();
    renderScreen({ data: { ...VALID_DATA, startTime: "" } });

    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByLabelText("Start time")).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveTextContent("Start time is required.");
  });

  it("focuses the first duration radio when duration is the first invalid group", async () => {
    const user = userEvent.setup();
    renderScreen({ data: { ...VALID_DATA, duration: "" } });

    await user.click(screen.getByRole("button", { name: "Continue" }));

    const firstDuration = screen.getByRole("radio", { name: "60 min" });
    await waitFor(() => expect(firstDuration).toHaveFocus());
    expect(firstDuration).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Select a duration.");
  });

  it("focuses the first shoot-type tile when it is the first invalid group", async () => {
    const user = userEvent.setup();
    renderScreen({ data: { ...VALID_DATA, shootTypes: [] } });

    await user.click(screen.getByRole("button", { name: "Continue" }));

    const firstTile = screen.getByRole("button", { name: "Pre-shoot" });
    await waitFor(() => expect(firstTile).toHaveFocus());
    expect(firstTile).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Select at least one shoot type.");
  });

  it("passes timeline shortcut picks into the controlled start-time callback", async () => {
    const user = userEvent.setup();
    const { onChange } = renderScreen();

    await user.click(screen.getByRole("button", { name: "Start at golden hour" }));

    expect(onChange).toHaveBeenCalledWith("startTime", expect.stringMatching(/^\d{2}:(00|15|30|45)$/));
  });

  it("continues to crew and equipment when all fields are valid", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Crew destination")).toBeInTheDocument();
  });
});

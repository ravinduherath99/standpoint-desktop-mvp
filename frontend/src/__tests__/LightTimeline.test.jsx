import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const motionState = vi.hoisted(() => ({ reduced: false }));

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
      path: motionComponent("path"),
      rect: motionComponent("rect"),
      g: motionComponent("g"),
      circle: motionComponent("circle"),
    },
    useReducedMotion: () => motionState.reduced,
  };
});

import LightTimeline from "../components/LightTimeline";
import { getSunTimes } from "../lib/sun";
import { formatMinutes, toTimeValue } from "../lib/format";

const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const TICK_FONT_SIZE = 11;
let resizeCallback;
let disconnect;

function installResizeObserver() {
  disconnect = vi.fn();
  resizeCallback = undefined;
  global.ResizeObserver = vi.fn(function ResizeObserver(callback) {
    resizeCallback = callback;
    this.observe = vi.fn();
    this.disconnect = disconnect;
  });
}

function installMatchMedia(matches = false) {
  const removeEventListener = vi.fn();
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener,
    dispatchEvent: vi.fn(),
  }));
  return { removeEventListener };
}

function renderTimeline(overrides = {}) {
  const props = {
    date: "2026-10-24",
    startTime: "17:30",
    duration: "90 minutes",
    onPickTime: vi.fn(),
    ...overrides,
  };
  return { ...render(<LightTimeline {...props} />), props };
}

function tickLabels(chart) {
  return [...chart.querySelectorAll(".light-timeline-tick text")];
}

function expectVisibleNonOverlappingTicks(labels, chartWidth) {
  const bounds = labels.map((label) => {
    const center = Number(label.getAttribute("x"));
    const estimatedWidth = label.textContent.length * TICK_FONT_SIZE * 0.6;
    return { left: center - estimatedWidth / 2, right: center + estimatedWidth / 2 };
  });

  expect(bounds[0].left).toBeGreaterThanOrEqual(0);
  expect(bounds.at(-1).right).toBeLessThanOrEqual(chartWidth);
  bounds.slice(1).forEach((boundsForLabel, index) => {
    expect(boundsForLabel.left).toBeGreaterThan(bounds[index].right);
  });
}

describe("LightTimeline", () => {
  beforeEach(() => {
    motionState.reduced = false;
    installResizeObserver();
    installMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete global.ResizeObserver;
  });

  it("uses Melbourne today until a date is selected without changing form state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T02:00:00Z"));
    const onPickTime = vi.fn();
    renderTimeline({ date: "", startTime: "", duration: "", onPickTime });

    expect(screen.getByText("Today, until you pick a date")).toBeInTheDocument();
    expect(screen.queryByText(/Fixed at Carlton Gardens, Melbourne/i)).not.toBeInTheDocument();
    expect(onPickTime).not.toHaveBeenCalled();
  });

  it("shows Melbourne sun times and a compact calculated legend for a selected date", () => {
    renderTimeline();
    const times = getSunTimes("2026-10-24");
    const legend = screen.getByRole("list", { name: "Key light times" });

    expect(screen.getByText("Melbourne sun times")).toBeInTheDocument();
    expect(legend).toHaveTextContent(`Sunrise${formatMinutes(times.sunrise)}`);
    expect(legend).toHaveTextContent(`Golden hour${formatMinutes(times.golden.evening.start)}–${formatMinutes(times.golden.evening.end)}`);
    expect(legend).toHaveTextContent(`Sunset${formatMinutes(times.sunset)}`);
    expect(legend.querySelectorAll("svg")).toHaveLength(3);
  });

  it("shows an explicit state for an invalid non-empty date", () => {
    renderTimeline({ date: "2026-02-29" });
    expect(screen.getByText(/Choose a valid shoot date to preview the light/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders an accessible SVG summary and all light phase bands", () => {
    renderTimeline();
    const chart = screen.getByRole("img", { name: /Light on the day/i });
    const times = getSunTimes("2026-10-24");
    expect(chart).toHaveTextContent(/Daylight and shoot window timeline/i);
    expect(chart).toHaveTextContent(`Sunrise is ${formatMinutes(times.sunrise)}`);
    expect(chart).toHaveTextContent(`sunset is ${formatMinutes(times.sunset)}`);
    expect(chart).toHaveTextContent(screen.getByRole("status").textContent);
    expect(chart).toHaveClass("light-timeline-svg");
    expect(chart.parentElement).toHaveClass("light-timeline");
    [
      screen.getByTestId("light-background-night"),
      screen.getByTestId("light-background-day"),
      screen.getByTestId("light-band-morning-blue"),
      screen.getByTestId("light-band-morning-golden"),
      screen.getByTestId("light-band-evening-golden"),
      screen.getByTestId("light-band-evening-blue"),
    ].forEach((period) => {
      expect(period).toHaveAttribute("y", "12");
      expect(period).toHaveAttribute("height", "106");
    });
    expect(screen.getByTestId("solar-arc")).toBeInTheDocument();
  });

  it("shows a golden shoot window and end-time-focused overlap insight", () => {
    const evening = getSunTimes("2026-10-24").golden.evening;
    const start = Math.ceil(evening.start / 15) * 15;
    renderTimeline({ startTime: toTimeValue(start), duration: "60 minutes" });
    expect(screen.getByTestId("shoot-window")).toHaveAttribute("data-tone", "golden");
    expect(screen.getByTestId("shoot-window")).toHaveAttribute("y", "12");
    expect(screen.getByTestId("shoot-window")).toHaveAttribute("height", "106");
    const overlap = Math.min(start + 60, evening.end) - start;
    expect(screen.getByRole("status")).toHaveTextContent(
      `Your shoot runs to ${formatMinutes(start + 60)} and catches ${overlap} min of golden hour.`
    );
  });

  it("describes a general daylight ending", () => {
    renderTimeline({ startTime: "12:00", duration: "60 minutes" });
    expect(screen.getByTestId("shoot-window")).toHaveAttribute("data-tone", "standard");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your shoot runs to 1:00 pm in full daylight."
    );
  });

  it("describes an ending shortly before evening golden hour", () => {
    const times = getSunTimes("2026-10-24");
    const end = times.golden.evening.start - 30;
    renderTimeline({ startTime: toTimeValue(end - 60), duration: "60 minutes" });

    expect(screen.getByRole("status")).toHaveTextContent(
      `Your shoot ends at ${formatMinutes(end)}, 30 min before golden hour starts.`
    );
  });

  it("describes blue-hour and after-dark endings", () => {
    const times = getSunTimes("2026-10-24");
    const blueEnd = times.blue.morning.start + 5;
    const { rerender } = render(
      <LightTimeline
        date="2026-10-24"
        startTime={toTimeValue(blueEnd - 60)}
        duration="60 minutes"
        onPickTime={vi.fn()}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      `Your shoot runs to ${formatMinutes(blueEnd)}, in blue hour, after the golden light.`
    );

    rerender(
      <LightTimeline date="2026-10-24" startTime="23:00" duration="60 minutes" onPickTime={vi.fn()} />
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your shoot runs to 12:00 am (+1 day), after dark. Plan for artificial light."
    );
  });

  it("uses one helpful fallback when start or duration is unavailable", () => {
    const { rerender } = render(
      <LightTimeline date="2026-10-24" startTime="" duration="90 minutes" onPickTime={vi.fn()} />
    );
    expect(screen.queryByTestId("shoot-window")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Tap the timeline or pick a start time to see your shoot against the light."
    );

    rerender(
      <LightTimeline date="2026-10-24" startTime="17:30" duration="Select duration" onPickTime={vi.fn()} />
    );
    expect(screen.queryByTestId("shoot-window")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Tap the timeline or pick a start time to see your shoot against the light."
    );
  });

  it("preserves explicit next-day formatting for cross-midnight shoots", () => {
    renderTimeline({ startTime: "23:30", duration: "90 minutes" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your shoot runs to 1:00 am (+1 day), after dark. Plan for artificial light."
    );
  });

  it("recalculates the insight when start time, duration and date change", () => {
    const { rerender } = render(
      <LightTimeline date="2026-10-24" startTime="12:00" duration="60 minutes" onPickTime={vi.fn()} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("runs to 1:00 pm in full daylight");

    rerender(
      <LightTimeline date="2026-10-24" startTime="13:00" duration="60 minutes" onPickTime={vi.fn()} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("runs to 2:00 pm in full daylight");

    rerender(
      <LightTimeline date="2026-10-24" startTime="13:00" duration="2 hours" onPickTime={vi.fn()} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("runs to 3:00 pm in full daylight");

    rerender(
      <LightTimeline date="2026-06-21" startTime="16:30" duration="60 minutes" onPickTime={vi.fn()} />
    );
    expect(screen.getByRole("status")).toHaveTextContent(/golden hour|blue hour|after dark/i);
  });

  it("shows a snapped pointer guide and emits a strict time value on click", () => {
    const { props } = renderTimeline();
    const chart = screen.getByRole("img");
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      width: 480,
      height: 132,
      top: 0,
      left: 0,
      right: 480,
      bottom: 132,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(chart, { clientX: 240 });
    const pointer = screen.getByTestId("pointer-guide");
    expect(pointer).toHaveTextContent(/\d{1,2}:\d{2} [ap]m/i);
    expect(pointer.querySelector("line")).toHaveAttribute("y1", "12");
    expect(pointer.querySelector("line")).toHaveAttribute("y2", "118");
    fireEvent.click(chart, { clientX: 240 });
    expect(props.onPickTime).toHaveBeenCalledWith(expect.stringMatching(/^\d{2}:(00|15|30|45)$/));
    fireEvent.pointerLeave(chart);
    expect(screen.queryByTestId("pointer-guide")).not.toBeInTheDocument();
  });

  it("emits one snapped value for a touch selection and ignores the synthetic click", () => {
    const { props } = renderTimeline();
    const chart = screen.getByRole("img");
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      width: 480,
      height: 132,
      top: 0,
      left: 0,
      right: 480,
      bottom: 132,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerUp(chart, { clientX: 240, pointerType: "touch" });
    fireEvent.click(chart, { clientX: 240 });

    expect(props.onPickTime).toHaveBeenCalledOnce();
    expect(props.onPickTime).toHaveBeenCalledWith(expect.stringMatching(/^\d{2}:(00|15|30|45)$/));
  });

  it("offers a keyboard-operable golden-hour shortcut", async () => {
    const user = userEvent.setup();
    const { props } = renderTimeline({ startTime: "", duration: "" });
    await user.click(screen.getByRole("button", { name: /Start at golden hour/i }));

    const evening = getSunTimes("2026-10-24").golden.evening;
    const picked = props.onPickTime.mock.calls[0][0];
    const pickedMinutes = Number(picked.slice(0, 2)) * 60 + Number(picked.slice(3));
    expect(picked).toMatch(/^\d{2}:(00|15|30|45)$/);
    expect(pickedMinutes).toBeGreaterThanOrEqual(evening.start);
    expect(pickedMinutes).toBeLessThanOrEqual(evening.end);
    expect(toTimeValue(pickedMinutes)).toBe(picked);
  });

  it("uses the observed width for a responsive viewBox and tick density", () => {
    renderTimeline();
    const chart = screen.getByRole("img");
    expect(chart).toHaveAttribute("data-tick-step", "2");
    expect(chart).toHaveAttribute("width", "100%");
    expect(chart).toHaveAttribute("viewBox", "0 0 260 132");

    act(() => resizeCallback([{ contentRect: { width: 419 } }]));
    expect(chart).toHaveAttribute("data-tick-step", "4");
    expect(chart).toHaveAttribute("viewBox", "0 0 419 132");

    act(() => resizeCallback([{ contentRect: { width: 420 } }]));
    expect(chart).toHaveAttribute("data-tick-step", "2");
    expect(chart).toHaveAttribute("viewBox", "0 0 420 132");

    act(() => resizeCallback([{ contentRect: { width: 760 } }]));
    expect(chart).toHaveAttribute("data-tick-step", "2");
    expect(chart).toHaveAttribute("viewBox", "0 0 760 132");

    act(() => resizeCallback([{ contentRect: { width: 220 } }]));
    expect(chart).toHaveAttribute("viewBox", "0 0 260 132");
  });

  it("renders the exact interval-relative desktop ticks without collisions", () => {
    renderTimeline();
    const chart = screen.getByRole("img");

    act(() => resizeCallback([{ contentRect: { width: 760 } }]));

    const labels = tickLabels(chart);
    expect(labels.map((label) => label.textContent)).toEqual([
      "5 am",
      "7 am",
      "9 am",
      "11 am",
      "1 pm",
      "3 pm",
      "5 pm",
      "7 pm",
      "9 pm",
    ]);
    expect(labels).toHaveLength(9);
    labels.forEach((label) => expect(label).toHaveAttribute("text-anchor", "middle"));
    expect(labels[0]).toHaveAttribute("x", "16");
    expect(labels.at(-1)).toHaveAttribute("x", "744");
    expectVisibleNonOverlappingTicks(labels, 760);
  });

  it("renders the exact interval-relative narrow ticks without collisions", () => {
    renderTimeline();
    const chart = screen.getByRole("img");

    act(() => resizeCallback([{ contentRect: { width: 419 } }]));

    const labels = tickLabels(chart);
    expect(labels.map((label) => label.textContent)).toEqual([
      "5 am",
      "9 am",
      "1 pm",
      "5 pm",
      "9 pm",
    ]);
    expect(labels).toHaveLength(5);
    labels.forEach((label) => expect(label).toHaveAttribute("text-anchor", "middle"));
    expect(labels[0]).toHaveAttribute("x", "16");
    expect(labels.at(-1)).toHaveAttribute("x", "403");
    expectVisibleNonOverlappingTicks(labels, 419);
  });

  it("uses compact medium tabular typography for tick labels", () => {
    expect(styles).toMatch(
      /\.light-timeline-tick text \{ fill: var\(--ink-500\); font-family: var\(--font-text\); font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; pointer-events: none; \}/
    );
  });

  it("disconnects ResizeObserver when unmounted", () => {
    const { unmount } = renderTimeline();
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("renders final motion states when reduced motion is preferred", () => {
    motionState.reduced = true;
    renderTimeline();
    expect(screen.getByTestId("solar-arc")).toHaveAttribute("data-motion", "reduced");
    expect(screen.getByTestId("sun-position")).toHaveAttribute("data-motion", "reduced");
  });
});
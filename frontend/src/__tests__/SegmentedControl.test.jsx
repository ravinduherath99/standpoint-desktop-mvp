import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SegmentedControl from "../components/SegmentedControl";

const OPTIONS = [
  { value: "60 minutes", label: "60 min" },
  { value: "90 minutes", label: "90 min" },
  { value: "2 hours", label: "2 hr" },
  { value: "3 hours", label: "3 hr" },
];

function ControlledSegmentedControl({ onChange = vi.fn(), error }) {
  const [value, setValue] = useState("90 minutes");
  return (
    <SegmentedControl
      label="Duration"
      name="duration"
      options={OPTIONS}
      value={value}
      error={error}
      onChange={(nextValue) => {
        setValue(nextValue);
        onChange(nextValue);
      }}
    />
  );
}

describe("SegmentedControl", () => {
  it("renders a labelled native radio group with controlled state", () => {
    render(<ControlledSegmentedControl />);

    expect(screen.getByRole("group", { name: "Duration" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "90 min" })).toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("radio", { name: "2 hr" })).toHaveAttribute("value", "2 hours");
  });

  it("emits the unchanged duration value when a segment is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSegmentedControl onChange={onChange} />);

    await user.click(screen.getByText("2 hr"));

    expect(onChange).toHaveBeenCalledWith("2 hours");
    expect(screen.getByRole("radio", { name: "2 hr" })).toBeChecked();
  });

  it("supports native arrow-key movement within the radio group", async () => {
    const user = userEvent.setup();
    render(<ControlledSegmentedControl />);
    const selected = screen.getByRole("radio", { name: "90 min" });

    selected.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "2 hr" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "2 hr" })).toHaveFocus();
  });

  it("associates errors and marks the first focus target invalid", () => {
    render(<ControlledSegmentedControl error="Select a duration." />);
    const radios = screen.getAllByRole("radio");
    const alert = screen.getByRole("alert");

    expect(radios[0]).toHaveAttribute("aria-invalid", "true");
    expect(radios[0]).toHaveAttribute("aria-describedby", alert.id);
    expect(radios[1]).not.toHaveAttribute("aria-invalid");
    expect(alert).toHaveTextContent("Select a duration.");
  });
});
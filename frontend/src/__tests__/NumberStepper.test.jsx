import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NumberStepper from "../components/NumberStepper";

function renderStepper(props = {}) {
  const onChange = props.onChange || vi.fn();
  const result = render(
    <NumberStepper
      id="people"
      label="People on site"
      value=""
      onChange={onChange}
      helper="Include everyone."
      {...props}
    />
  );

  return { onChange, ...result };
}

describe("NumberStepper", () => {
  it("preserves an empty controlled value without calling onChange on render", () => {
    const { onChange } = renderStepper();
    const input = screen.getByLabelText("People on site");

    expect(input).toHaveValue(null);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Decrease people on site" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase people on site" })).toBeEnabled();
  });

  it("increments an empty value to the minimum and clamps native edits as strings", async () => {
    const user = userEvent.setup();
    const { onChange } = renderStepper();

    await user.click(screen.getByRole("button", { name: "Increase people on site" }));
    expect(onChange).toHaveBeenCalledWith("1");

    fireEvent.change(screen.getByLabelText("People on site"), { target: { value: "12" } });
    expect(onChange).toHaveBeenLastCalledWith("12");

    fireEvent.change(screen.getByLabelText("People on site"), { target: { value: "0" } });
    expect(onChange).toHaveBeenLastCalledWith("1");

    fireEvent.change(screen.getByLabelText("People on site"), { target: { value: "51" } });
    expect(onChange).toHaveBeenLastCalledWith("50");
  });

  it("clamps stepper controls to 1–50", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = renderStepper({ value: "1", onChange });

    expect(screen.getByRole("button", { name: "Decrease people on site" })).toBeDisabled();

    rerender(
      <NumberStepper id="people" label="People on site" value="49" onChange={onChange} />
    );
    await user.click(screen.getByRole("button", { name: "Increase people on site" }));
    expect(onChange).toHaveBeenLastCalledWith("50");

    rerender(
      <NumberStepper id="people" label="People on site" value="50" onChange={onChange} />
    );
    expect(screen.getByRole("button", { name: "Increase people on site" })).toBeDisabled();

    rerender(
      <NumberStepper id="people" label="People on site" value="2" onChange={onChange} />
    );
    await user.click(screen.getByRole("button", { name: "Decrease people on site" }));
    expect(onChange).toHaveBeenLastCalledWith("1");
  });

  it("exposes native numeric limits and stable helper/error associations", () => {
    renderStepper({ error: "People count is required." });
    const input = screen.getByLabelText("People on site");

    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "50");
    expect(input).toHaveAttribute("step", "1");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "people-helper people-error");
    expect(screen.getByText("Include everyone.")).toHaveAttribute("id", "people-helper");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "people-error");
  });

  it("renders at most eight decorative people and an overflow count", () => {
    const { container, rerender } = renderStepper({ value: "11" });

    const stepper = container.querySelector(".stepper");
    const children = [...stepper.children];
    const figures = container.querySelectorAll(".stepper-figure");
    expect(children[0]).toHaveAccessibleName("Decrease people on site");
    expect(children[1]).toBe(screen.getByLabelText("People on site"));
    expect(children[2]).toHaveAccessibleName("Increase people on site");
    expect(children[3]).toHaveClass("stepper-figures");
    expect(figures).toHaveLength(8);
    expect(figures[0]).toHaveAttribute("viewBox", "0 0 16 22");
    expect(figures[0].querySelector("circle")).toHaveAttribute("cx", "8");
    expect(figures[0].querySelector("path")).toHaveAttribute(
      "d",
      "M1 21v-4.5C1 12.9 4.1 10.5 8 10.5s7 2.4 7 6V21Z"
    );
    expect([...figures].map((figure) => figure.style.getPropertyValue("--i"))).toEqual([
      "0", "1", "2", "3", "4", "5", "6", "7",
    ]);
    expect(container.querySelector(".stepper-more")).toHaveTextContent("+3");
    expect(container.querySelector(".stepper-figures")).toHaveAttribute("aria-hidden", "true");

    rerender(
      <NumberStepper id="people" label="People on site" value="51" onChange={vi.fn()} />
    );
    expect(container.querySelectorAll(".stepper-figure")).toHaveLength(0);
    expect(container.querySelector(".stepper-more")).not.toBeInTheDocument();
  });

  it("keeps existing index-keyed figures mounted when a person is added", () => {
    const { container, rerender } = renderStepper({ value: "3" });
    const existingFigures = [...container.querySelectorAll(".stepper-figure")];

    rerender(
      <NumberStepper id="people" label="People on site" value="4" onChange={vi.fn()} />
    );

    const updatedFigures = [...container.querySelectorAll(".stepper-figure")];
    expect(updatedFigures).toHaveLength(4);
    expect(updatedFigures.slice(0, 3)).toEqual(existingFigures);
    expect(updatedFigures[3]).not.toBe(existingFigures[2]);
  });
});
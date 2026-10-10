import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FlowButton from "../components/FlowButton";

describe("FlowButton", () => {
  it("renders default text 'Continue'", () => {
    render(<FlowButton />);
    expect(
      screen.getByRole("button", { name: "Continue" })
    ).toBeInTheDocument();
  });

  it("renders custom text via text prop", () => {
    render(<FlowButton text="Submit plan" />);
    expect(
      screen.getByRole("button", { name: "Submit plan" })
    ).toBeInTheDocument();
  });

  it("defaults to type=button", () => {
    render(<FlowButton />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("accepts type=submit", () => {
    render(<FlowButton type="submit" />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("applies flow-button class", () => {
    render(<FlowButton />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("flow-button");
  });

  it("merges caller className", () => {
    render(<FlowButton className="extra" />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("flow-button");
    expect(btn.className).toContain("extra");
  });

  it("renders left and right arrow icons", () => {
    const { container } = render(<FlowButton />);
    const leftArrow = container.querySelector(".flow-button__arrow--left");
    const rightArrow = container.querySelector(".flow-button__arrow--right");
    expect(leftArrow).toBeInTheDocument();
    expect(rightArrow).toBeInTheDocument();
    expect(leftArrow).toHaveAttribute("aria-hidden", "true");
    expect(rightArrow).toHaveAttribute("aria-hidden", "true");
  });

  it("renders expanding circle element", () => {
    const { container } = render(<FlowButton />);
    const circle = container.querySelector(".flow-button__circle");
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute("aria-hidden", "true");
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<FlowButton onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables button when disabled prop is true", () => {
    render(<FlowButton disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies disabled class when disabled", () => {
    render(<FlowButton disabled />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("flow-button--disabled");
  });

  it("disables button when loading is true", () => {
    render(<FlowButton loading />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("sets aria-busy=true when loading", () => {
    render(<FlowButton loading />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("does not set aria-busy when not loading", () => {
    render(<FlowButton />);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });

  it("loading overrides disabled=false — button stays disabled", () => {
    render(<FlowButton loading disabled={false} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("forwards aria-label to the button", () => {
    render(<FlowButton aria-label="Continue to next step" />);
    expect(
      screen.getByRole("button", { name: "Continue to next step" })
    ).toBeInTheDocument();
  });

  it("includes accessible text span", () => {
    render(<FlowButton text="Go" />);
    expect(screen.getByText("Go")).toBeInTheDocument();
  });
});


describe("FlowButton visual", () => {
  it("does not set aria-busy when not loading", () => {
    render(<FlowButton />);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });
  it("renders left and right arrow icons in DOM", () => {
    const { container } = render(<FlowButton />);
    expect(container.querySelector(".flow-button__arrow--left")).toBeInTheDocument();
    expect(container.querySelector(".flow-button__arrow--right")).toBeInTheDocument();
  });
  it("renders expanding circle element in DOM", () => {
    const { container } = render(<FlowButton />);
    expect(container.querySelector(".flow-button__circle")).toBeInTheDocument();
  });
});

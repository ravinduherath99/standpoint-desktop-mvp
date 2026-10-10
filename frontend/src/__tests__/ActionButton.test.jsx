import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionButton from "../components/ActionButton";

describe("ActionButton", () => {
  it("renders children text", () => {
    render(<ActionButton>Continue</ActionButton>);
    expect(
      screen.getByRole("button", { name: "Continue" })
    ).toBeInTheDocument();
  });

  it("defaults to type=button", () => {
    render(<ActionButton>Go</ActionButton>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("accepts type=submit", () => {
    render(<ActionButton type="submit">Submit</ActionButton>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("applies primary variant class by default", () => {
    render(<ActionButton>Go</ActionButton>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("action-button");
    expect(btn.className).toContain("primary");
  });

  it("applies secondary variant class", () => {
    render(<ActionButton variant="secondary">Back</ActionButton>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("action-button");
    expect(btn.className).toContain("secondary");
  });

  it("merges caller className with computed classes", () => {
    render(<ActionButton className="extra">Go</ActionButton>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("action-button");
    expect(btn.className).toContain("primary");
    expect(btn.className).toContain("extra");
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ActionButton onClick={onClick}>Go</ActionButton>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables button when disabled prop is true", () => {
    render(<ActionButton disabled>Go</ActionButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not set aria-busy when not loading", () => {
    render(<ActionButton>Go</ActionButton>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });

  it("disables button when loading is true", () => {
    render(<ActionButton loading>Go</ActionButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("sets aria-busy=true when loading", () => {
    render(<ActionButton loading>Go</ActionButton>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("renders spinner when loading", () => {
    const { container } = render(<ActionButton loading>Go</ActionButton>);
    const spinner = container.querySelector(".action-button-spinner");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute("aria-hidden", "true");
  });

  it("does not render spinner when not loading", () => {
    const { container } = render(<ActionButton>Go</ActionButton>);
    expect(
      container.querySelector(".action-button-spinner")
    ).not.toBeInTheDocument();
  });

  it("keeps children visible when loading", () => {
    render(<ActionButton loading>Continue</ActionButton>);
    expect(
      screen.getByRole("button", { name: /Continue/ })
    ).toBeInTheDocument();
  });

  it("loading overrides disabled=false — button stays disabled", () => {
    render(
      <ActionButton loading disabled={false}>
        Go
      </ActionButton>
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("forwards aria-label to the button", () => {
    render(<ActionButton aria-label="Close dialog">X</ActionButton>);
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();
  });
});


describe("ActionButton visual", () => {
  it("secondary variant renders with correct class", () => {
    const { container } = render(<ActionButton variant="secondary">Back</ActionButton>);
    const btn = container.querySelector(".action-button.secondary");
    expect(btn).toBeInTheDocument();
  });
  it("primary variant renders with correct class", () => {
    const { container } = render(<ActionButton>Go</ActionButton>);
    const btn = container.querySelector(".action-button.primary");
    expect(btn).toBeInTheDocument();
  });
});

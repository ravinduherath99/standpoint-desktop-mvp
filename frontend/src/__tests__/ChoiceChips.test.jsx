import { Camera, Heart } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChoiceChips from "../components/ChoiceChips";

describe("ChoiceChips", () => {
  it("keeps string options and the default chip variant compatible", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { container } = render(
      <ChoiceChips
        label="Equipment"
        name="equipment"
        options={["Camera", "Drone"]}
        selected={["Camera"]}
        flaggedOptions={["Drone"]}
        onToggle={onToggle}
      />
    );

    expect(container.querySelector(".choice-chips--chips")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Camera" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Camera" }).querySelector(".choice-chip-check")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drone" })).toHaveClass("choice-chip--flagged");

    await user.click(screen.getByRole("button", { name: "Drone" }));
    expect(onToggle).toHaveBeenCalledWith("Drone");
  });

  it("renders object options with decorative icons in the tile variant", () => {
    const { container } = render(
      <ChoiceChips
        label="Shoot type"
        name="shootTypes"
        options={[
          { value: "Wedding", label: "Wedding", icon: Heart },
          { value: "Portrait", label: "Portrait", icon: Camera },
        ]}
        selected={["Wedding"]}
        variant="tiles"
        onToggle={vi.fn()}
      />
    );

    expect(container.querySelector(".choice-chips--tiles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wedding" }).querySelector(".choice-chip-icon")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Wedding" })).toHaveClass("choice-chip--selected");
  });

  it("associates an error with every choice and marks only the first invalid", () => {
    render(
      <ChoiceChips
        label="Shoot type"
        name="shootTypes"
        options={["Wedding", "Portrait"]}
        selected={[]}
        error="Select at least one shoot type."
        onToggle={vi.fn()}
      />
    );
    const buttons = screen.getAllByRole("button");
    const alert = screen.getByRole("alert");

    expect(buttons[0]).toHaveAttribute("aria-invalid", "true");
    expect(buttons[0]).toHaveAttribute("aria-describedby", alert.id);
    expect(buttons[1]).toHaveAttribute("aria-describedby", alert.id);
    expect(buttons[1]).not.toHaveAttribute("aria-invalid");
  });
});
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Camera } from "lucide-react";
import FormField from "../components/FormField";

describe("FormField", () => {
  it("renders a label linked to the control", () => {
    render(<FormField label="Email address" id="email" />);
    const input = screen.getByLabelText("Email address");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("id", "email");
  });

  it("uses useId when id is not supplied", () => {
    render(<FormField label="Name" />);
    const input = screen.getByLabelText("Name");
    expect(input.id).toBeTruthy();
  });

  it("renders an input by default", () => {
    render(<FormField label="Location" id="loc" type="text" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders a select when options are supplied", () => {
    render(
      <FormField label="Duration" id="dur" options={["60 min", "90 min"]} />
    );
    const select = screen.getByLabelText("Duration");
    expect(select.tagName).toBe("SELECT");
    expect(screen.getByText("60 min")).toBeInTheDocument();
    expect(screen.getByText("90 min")).toBeInTheDocument();
  });

  it("renders a textarea when multiline is true", () => {
    render(<FormField label="Notes" id="notes" multiline />);
    const textarea = screen.getByLabelText("Notes");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("rows", "5");
  });

  it("forwards value and onChange to the control", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FormField label="Name" id="nm" value="" onChange={onChange} />
    );
    await user.type(screen.getByLabelText("Name"), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("forwards type, min, max, step to the input", () => {
    render(
      <FormField
        label="People"
        id="ppl"
        type="number"
        min="1"
        max="50"
        step="1"
      />
    );
    const input = screen.getByLabelText("People");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "50");
    expect(input).toHaveAttribute("step", "1");
  });

  it("renders helper text with correct id", () => {
    render(
      <FormField label="Email" id="em" helper="e.g. name@example.com" />
    );
    const helper = screen.getByText("e.g. name@example.com");
    expect(helper).toHaveAttribute("id", "em-helper");
    expect(helper).toHaveClass("field-helper");
  });

  it("does not render helper when not supplied", () => {
    render(<FormField label="Email" id="em" />);
    expect(document.querySelector(".field-helper")).not.toBeInTheDocument();
  });

  it("renders error with role=alert and correct id", () => {
    render(
      <FormField label="Email" id="em" error="Email is required." />
    );
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Email is required.");
    expect(error).toHaveAttribute("id", "em-error");
  });

  it("does not render error when not supplied", () => {
    render(<FormField label="Email" id="em" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sets aria-invalid only when error is present", () => {
    const { rerender } = render(
      <FormField label="Email" id="em" error="Required" />
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    rerender(<FormField label="Email" id="em" />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute(
      "aria-invalid"
    );
  });

  it("builds aria-describedby from helper and error ids", () => {
    render(
      <FormField
        label="Email"
        id="em"
        helper="Helper text"
        error="Error text"
      />
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-describedby",
      "em-helper em-error"
    );
  });

  it("builds aria-describedby from helper only when no error", () => {
    render(
      <FormField label="Email" id="em" helper="Helper text" />
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-describedby",
      "em-helper"
    );
  });

  it("builds aria-describedby from error only when no helper", () => {
    render(
      <FormField label="Email" id="em" error="Error text" />
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-describedby",
      "em-error"
    );
  });

  it("does not set aria-describedby when neither helper nor error", () => {
    render(<FormField label="Email" id="em" />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute(
      "aria-describedby"
    );
  });

  it("renders icon with aria-hidden when supplied", () => {
    const { container } = render(
      <FormField label="Email" id="em" icon={Camera} />
    );
    const icon = container.querySelector(".field-icon");
    expect(icon).toBeInTheDocument();
    expect(icon.closest("[aria-hidden]")).toBeTruthy();
  });

  it("does not render icon when not supplied", () => {
    const { container } = render(
      <FormField label="Email" id="em" />
    );
    expect(container.querySelector(".field-icon")).not.toBeInTheDocument();
  });

  it("applies additional className to the field wrapper", () => {
    const { container } = render(
      <FormField label="Email" id="em" className="custom" />
    );
    const wrapper = container.querySelector(".field");
    expect(wrapper.className).toContain("custom");
    expect(wrapper.className).toContain("field");
  });
});


describe("FormField endAdornment and counter", () => {
  it("renders endAdornment inside field-control-wrapper", () => {
    const { container } = render(<FormField label="Test" id="t" endAdornment={<span>$</span>} />);
    expect(container.querySelector(".field-control-wrapper")).toBeInTheDocument();
    expect(container.querySelector(".field-end-adornment")).toBeInTheDocument();
  });
  it("renders counter with max only", () => {
    render(<FormField label="Notes" id="n" multiline value="hello" counter={{ max: 200 }} />);
    expect(screen.getByText("5 / 200")).toBeInTheDocument();
  });
  it("counter shows --ok state when within range", () => {
    const { container } = render(<FormField label="Notes" id="n" value="hello" counter={{ min: 3, max: 200 }} />);
    expect(container.querySelector(".field-counter--ok")).toBeInTheDocument();
  });
  it("counter id is in aria-describedby", () => {
    render(<FormField label="Notes" id="n" value="hi" counter={{ max: 200 }} />);
    expect(screen.getByLabelText("Notes")).toHaveAttribute("aria-describedby", "n-counter");
  });
  it("builds aria-describedby with helper, counter, and error", () => {
    render(<FormField label="Notes" id="n" helper="Help" value="hi" counter={{ max: 200 }} error="Err" />);
    expect(screen.getByLabelText("Notes")).toHaveAttribute("aria-describedby", "n-helper n-counter n-error");
  });
  it("counter respects trimmed length", () => {
    render(<FormField label="Notes" id="n" value="   hello   " counter={{ max: 200 }} />);
    expect(screen.getByText("5 / 200")).toBeInTheDocument();
  });
  it("does not render counter for select fields", () => {
    const { container } = render(<FormField label="Duration" id="d" options={["60 min"]} counter={{ max: 200 }} />);
    expect(container.querySelector(".field-counter-bar")).not.toBeInTheDocument();
  });
  it("backward compat: showCharCount + maxLength still works", () => {
    render(<FormField label="Notes" id="n" value="hello" showCharCount maxLength={200} />);
    expect(screen.getByText("5 / 200")).toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Camera } from "lucide-react";
import FormSection from "../components/FormSection";

describe("FormSection", () => {
  it("renders the title", () => {
    render(
      <FormSection title="Account details">
        <p>Child content</p>
      </FormSection>
    );
    expect(
      screen.getByRole("heading", { name: "Account details", level: 2 })
    ).toBeInTheDocument();
  });

  it("renders children inside form-section-body", () => {
    render(
      <FormSection title="Test">
        <p>Inner text</p>
      </FormSection>
    );
    expect(screen.getByText("Inner text")).toBeInTheDocument();
  });

  it("renders description when supplied", () => {
    render(
      <FormSection title="Test" description="Some description">
        <p>Child</p>
      </FormSection>
    );
    expect(screen.getByText("Some description")).toBeInTheDocument();
  });

  it("does not render description when omitted", () => {
    render(
      <FormSection title="Test">
        <p>Child</p>
      </FormSection>
    );
    expect(screen.queryByText("Some description")).not.toBeInTheDocument();
  });

  it("renders icon with aria-hidden when supplied", () => {
    const { container } = render(
      <FormSection title="Test" icon={Camera}>
        <p>Child</p>
      </FormSection>
    );
    const iconWrapper = container.querySelector(".form-section-icon");
    expect(iconWrapper).toBeInTheDocument();
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true");
  });

  it("does not render icon wrapper when icon is omitted", () => {
    const { container } = render(
      <FormSection title="Test">
        <p>Child</p>
      </FormSection>
    );
    expect(container.querySelector(".form-section-icon")).not.toBeInTheDocument();
  });

  it("applies compact class when compact is true", () => {
    const { container } = render(
      <FormSection title="Test" compact>
        <p>Child</p>
      </FormSection>
    );
    const section = container.querySelector("section");
    expect(section.className).toContain("compact");
  });

  it("does not apply compact class when compact is false", () => {
    const { container } = render(
      <FormSection title="Test">
        <p>Child</p>
      </FormSection>
    );
    const section = container.querySelector("section");
    expect(section.className).not.toContain("compact");
  });

  it("sets aria-labelledby and heading id when id is supplied", () => {
    const { container } = render(
      <FormSection title="Test" id="my-section">
        <p>Child</p>
      </FormSection>
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("aria-labelledby", "my-section-heading");
    const heading = screen.getByRole("heading", { name: "Test", level: 2 });
    expect(heading).toHaveAttribute("id", "my-section-heading");
  });

  it("does not set aria-labelledby when id is omitted", () => {
    const { container } = render(
      <FormSection title="Test">
        <p>Child</p>
      </FormSection>
    );
    const section = container.querySelector("section");
    expect(section).not.toHaveAttribute("aria-labelledby");
  });

  it("renders a semantic section element", () => {
    const { container } = render(
      <FormSection title="Test">
        <p>Child</p>
      </FormSection>
    );
    expect(container.querySelector("section")).toBeInTheDocument();
  });
});

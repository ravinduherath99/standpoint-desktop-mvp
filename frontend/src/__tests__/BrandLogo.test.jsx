import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BrandLogo from "../components/BrandLogo";
import { MemoryRouter } from "react-router-dom";
import FlowShell from "../components/FlowShell";

describe("BrandLogo", () => {
  it("renders with accessible name StandPoint when not decorative", () => {
    const { container } = render(<BrandLogo />);
    const element = container.querySelector("span.sr-only");
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent("StandPoint");
    expect(screen.getAllByRole("img", { name: "StandPoint" })).toHaveLength(1);
  });

  it("hides accessible name when decorative", () => {
    const { container } = render(<BrandLogo decorative />);
    expect(container.querySelector("span.sr-only")).not.toBeInTheDocument();
  });

  it("renders the downloaded project asset as a decorative mark", () => {
    const { container } = render(<BrandLogo />);
    const mark = container.querySelector("img.brand-logo-mark");

    expect(mark).toHaveAttribute("src", expect.stringContaining("standpoint-icon-blue-transparent.png"));
    expect(mark).toHaveAttribute("alt", "");
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg.brand-logo-mark")).not.toBeInTheDocument();
  });

  it("keeps the mark proportional and renders the wordmark beside the image", () => {
    const { container } = render(<BrandLogo size={28} />);
    const logo = container.querySelector(".brand-logo");
    const mark = container.querySelector("img.brand-logo-mark");
    const wordmark = container.querySelector(".brand-logo-word");

    expect(logo).toHaveStyle({ "--brand-size": "28px" });
    expect(mark.nextElementSibling).toBe(wordmark);
    expect(wordmark).toHaveTextContent("standpoint");
    expect(wordmark).toHaveAttribute("aria-hidden", "true");
    expect([...wordmark.children].map((part) => part.textContent)).toEqual(["stand", "point"]);
    expect(wordmark.children[0]).toHaveClass("brand-logo-stand");
    expect(wordmark.children[1]).toHaveClass("brand-logo-point");
    expect(wordmark.children[0]).not.toHaveAttribute("style");
    expect(wordmark.children[1]).not.toHaveAttribute("style");
  });

  it("uses light tone colours when specified", () => {
    const { container } = render(<BrandLogo tone="light" />);
    expect(container.querySelector(".brand-logo")).toHaveClass("brand-logo--light");
  });
});

describe("FlowShell", () => {
  it("exposes the planner header brand identity", () => {
    const { container } = render(
      <MemoryRouter>
        <FlowShell data={{ location: "", shootDate: "", startTime: "", duration: "", shootTypes: [], people: "", equipment: [] }} />
      </MemoryRouter>
    );
    expect(screen.getByRole("img", { name: "StandPoint" })).toBeInTheDocument();
    expect(container.querySelector(".flow-header-logo")).toHaveStyle({ "--brand-size": "28px" });
    expect(container.querySelector(".flow-header-logo .brand-logo-word")).toHaveTextContent("standpoint");
  });

  it("signs out when button clicked", async () => {
    const onSignOut = vi.fn();
    render(
      <MemoryRouter>
        <FlowShell data={{ location: "", shootDate: "", startTime: "", duration: "", shootTypes: [], people: "", equipment: [] }} onSignOut={onSignOut} />
      </MemoryRouter>
    );
    const btn = screen.getByRole("button", { name: /Sign out/ });
    const user = userEvent.setup();
    await user.click(btn);
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});

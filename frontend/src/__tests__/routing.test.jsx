import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "../guards/ProtectedRoute";

describe("ProtectedRoute", () => {
  it("renders children when isAllowed is true", () => {
    render(
      <MemoryRouter>
        <ProtectedRoute isAllowed={true} redirectTo="/">
          <div>Protected content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("redirects (renders Navigate) when isAllowed is false", () => {
    render(
      <MemoryRouter initialEntries={["/shoot-details"]}>
        <ProtectedRoute isAllowed={false} redirectTo="/">
          <div>Protected content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    // When Navigate renders, children should not be in the DOM
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("guards work with isAuthenticated boolean (not email string)", () => {
    // Verify that isAllowed works as a simple boolean guard
    const { rerender } = render(
      <MemoryRouter>
        <ProtectedRoute isAllowed={false} redirectTo="/">
          <div>Planner content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText("Planner content")).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ProtectedRoute isAllowed={true} redirectTo="/">
          <div>Planner content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText("Planner content")).toBeInTheDocument();
  });
});

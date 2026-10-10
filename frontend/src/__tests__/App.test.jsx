import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom";

vi.mock("../utils/api", () => ({
  login: vi.fn(),
  signup: vi.fn(),
  savePlan: vi.fn(),
  fetchPlan: vi.fn(),
  SAFE_MESSAGES: {
    INVALID_CREDENTIALS: "Invalid email or password.",
    ACCOUNT_CREATION_FAILED: "Unable to create account. Please try again.",
    SERVICE_UNAVAILABLE: "Authentication service is temporarily unavailable.",
    NETWORK_ERROR: "Unable to reach the server. Please try again.",
    INVALID_RESPONSE: "Unexpected response from server.",
  },
}));

import App from "../App";
import { fetchPlan, login } from "../utils/api";

const CONFIRMATION_REFERENCE = "SP-app-confirm-123";
const CONFIRMATION_PLAN = {
  reference: CONFIRMATION_REFERENCE,
  plan: {
    location: "Carlton Gardens",
    shootDate: "2030-06-15",
    startTime: "14:00",
    duration: "2 hours",
    shootTypes: ["Portrait"],
    people: "5",
    equipment: ["Camera"],
    lightingPlan: "",
    accessNotes: "Main entrance gate will be open for the crew at 6am.",
  },
};

async function signIn(user, email = "confirm@example.com", token = "confirm-token") {
  login.mockResolvedValueOnce({
    access_token: token,
    user: { id: "confirm-user", email },
  });
  await user.type(screen.getByLabelText("Email address"), email);
  await user.type(screen.getByLabelText("Password"), "Pass123!");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("heading", { name: "Shoot Details" })).toBeInTheDocument();
}

describe("App authentication flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in, exposes the protected planner, and signs out safely", async () => {
    login.mockResolvedValueOnce({
      access_token: "app-token",
      user: { id: "app-user", email: "app@example.com" },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Email address"), "app@example.com");
    await user.type(screen.getByLabelText("Password"), "Pass123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Shoot Details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();

    const crewButton = screen.getByRole("button", { name: /Crew & Kit/i });
    expect(crewButton).not.toHaveAttribute("aria-disabled");
    await user.click(crewButton);
    expect(await screen.findByRole("heading", { name: "Crew & Kit" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Shoot Details" })).not.toBeInTheDocument();
  });

  it("guards planner routes with Location and People prerequisites", async () => {
    login.mockResolvedValueOnce({
      access_token: "guard-token",
      user: { id: "guard-user", email: "guard@example.com" },
    });
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [{ path: "*", element: <App /> }],
      { initialEntries: ["/"] }
    );
    render(<RouterProvider router={router} />);

    await user.type(screen.getByLabelText("Email address"), "guard@example.com");
    await user.type(screen.getByLabelText("Password"), "Pass123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Shoot Details" })).toBeInTheDocument();

    const location = screen.getByLabelText("Location");
    await user.clear(location);
    await user.type(location, "x");
    await act(() => router.navigate("/crew-equipment"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/shoot-details"));

    await user.clear(screen.getByLabelText("Location"));
    await user.type(screen.getByLabelText("Location"), "Carlton Gardens");
    await act(() => router.navigate("/crew-equipment"));
    expect(await screen.findByRole("heading", { name: "Crew & Kit" })).toBeInTheDocument();

    await act(() => router.navigate("/access-consent"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/crew-equipment"));

    await user.type(screen.getByLabelText("People on site"), "4");
    const peopleCell = screen.getByText("People").closest(".shoot-summary-cell");
    expect(peopleCell?.querySelector("dd")).toHaveTextContent("4");
    await act(() => router.navigate("/access-consent"));
    expect(await screen.findByRole("heading", { name: "Access & Consent" })).toBeInTheDocument();
  });

  it("allows an authenticated user with a valid reference to open Confirmation", async () => {
    fetchPlan.mockResolvedValueOnce(CONFIRMATION_PLAN);
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [{ path: "*", element: <App /> }],
      { initialEntries: ["/"] }
    );
    render(<RouterProvider router={router} />);

    await signIn(user);
    await act(() => router.navigate("/confirmation", {
      state: { reference: CONFIRMATION_REFERENCE },
    }));

    expect(await screen.findByRole("heading", { name: "Shoot plan prepared." })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/confirmation");
    expect(fetchPlan).toHaveBeenCalledWith(CONFIRMATION_REFERENCE, "confirm-token");
  });

  it("redirects a logged-out user from Confirmation to Login", async () => {
    const router = createMemoryRouter(
      [{ path: "*", element: <App /> }],
      {
        initialEntries: [{
          pathname: "/confirmation",
          state: { reference: CONFIRMATION_REFERENCE },
        }],
      }
    );
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(screen.queryByRole("heading", { name: "Shoot plan prepared." })).not.toBeInTheDocument();
    expect(fetchPlan).not.toHaveBeenCalled();
  });

  it("does not display Confirmation via Browser Back after authentication is cleared", async () => {
    fetchPlan.mockResolvedValueOnce(CONFIRMATION_PLAN);
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [{ path: "*", element: <App /> }],
      { initialEntries: ["/"] }
    );
    render(<RouterProvider router={router} />);

    await signIn(user);
    await act(() => router.navigate("/confirmation", {
      state: { reference: CONFIRMATION_REFERENCE },
    }));
    expect(await screen.findByRole("heading", { name: "Shoot plan prepared." })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Plan another shoot" }));
    expect(await screen.findByRole("heading", { name: "Shoot Details" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();

    await act(() => router.navigate(-1));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Shoot plan prepared." })).not.toBeInTheDocument();
  });
});

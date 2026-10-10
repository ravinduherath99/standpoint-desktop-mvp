import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginScreen from "../pages/LoginScreen";

// Mock the API module
vi.mock("../utils/api", () => ({
  login: vi.fn(),
  signup: vi.fn(),
  SAFE_MESSAGES: {
    INVALID_CREDENTIALS: "Invalid email or password.",
    ACCOUNT_CREATION_FAILED: "Unable to create account. Please try again.",
    SERVICE_UNAVAILABLE: "Authentication service is temporarily unavailable.",
    NETWORK_ERROR: "Unable to reach the server. Please try again.",
    INVALID_RESPONSE: "Unexpected response from server.",
  },
}));

import { login, signup } from "../utils/api";

function renderLogin(props = {}) {
  const defaults = {
    onLogin: vi.fn(),
    ...props,
  };
  return {
    ...render(
      <MemoryRouter>
        <LoginScreen {...defaults} />
      </MemoryRouter>
    ),
    onLogin: defaults.onLogin,
  };
}

describe("LoginScreen", () => {
  const getPasswordInput = () => screen.getByLabelText(/^password$/i);

  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("renders email and password fields with labels", () => {
    const { container } = renderLogin();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();

    const split = container.querySelector(".login-split");
    expect([...split.children].map((child) => child.className)).toEqual([
      "login-hero",
      "login-form-side",
    ]);
  });

  it("renders the shader behind one photographic hero without duplicate marker artwork", () => {
    const { container } = renderLogin();
    const hero = container.querySelector(".login-hero");
    const shader = hero.querySelector(".hero-shader-root");
    const images = hero.querySelectorAll(".login-hero-img");
    const heroContent = hero.querySelector(".login-hero-content");

    expect(hero.querySelectorAll(".hero-shader-root")).toHaveLength(1);
    expect(hero.firstElementChild).toBe(shader);
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", expect.stringContaining("standpoint-dusk.jpg"));
    expect(images[0]).toHaveAttribute("alt", "");
    expect(shader.nextElementSibling).toBe(images[0]);
    expect(images[0].nextElementSibling).toBe(heroContent);
    expect(hero.querySelector(".login-location-marker")).not.toBeInTheDocument();
    expect(hero.querySelector(".login-hero-scrim")).not.toBeInTheDocument();
  });

  it("renders the required hero copy and three feature cards", () => {
    const { container } = renderLogin();

    expect(screen.getByText("Photography shoot planner")).toBeInTheDocument();
    expect(screen.getByText("Arrive ready")).toBeInTheDocument();
    expect(screen.getByText("to shoot.")).toBeInTheDocument();
    expect(screen.getByText("Turn a location idea into a permit-ready plan, before the light changes.")).toBeInTheDocument();

    const heroCopy = container.querySelector(".login-hero-copy");
    const featureList = container.querySelector(".login-feature-list");
    expect(heroCopy.nextElementSibling).toBe(featureList);
    expect(featureList.querySelectorAll(".login-feature-card")).toHaveLength(3);

    for (const [title, description] of [
      ["Know the spot", "Location, date and crew in one plan"],
      ["Catch the light", "Golden-hour preview for your slot"],
      ["Follow the rules", "Access and consent before you go"],
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByText(description)).toBeInTheDocument();
    }

    expect(featureList.querySelector(".lucide-map-pin")).toBeInTheDocument();
    expect(featureList.querySelector(".lucide-sparkles")).toBeInTheDocument();
    expect(featureList.querySelector(".lucide-shield-check")).toBeInTheDocument();
  });

  it("uses the shared asset-backed wordmark at both login sizes and tones", () => {
    const { container } = renderLogin();
    const heroLogo = container.querySelector(".login-hero-logo");
    const cardLogo = container.querySelector(".login-card-logo");

    expect(heroLogo).toHaveClass("brand-logo--light");
    expect(heroLogo).toHaveStyle({ "--brand-size": "38px" });
    expect(cardLogo).toHaveClass("brand-logo--dark");
    expect(cardLogo).toHaveStyle({ "--brand-size": "30px" });

    for (const logo of [heroLogo, cardLogo]) {
      expect(logo.querySelector(".brand-logo-mark")).toHaveAttribute(
        "src",
        expect.stringContaining("standpoint-icon-blue-transparent.png")
      );
      expect(logo.querySelector(".brand-logo-word")).toHaveTextContent("standpoint");
    }
  });

  it("renders a Sign in button by default", () => {
    renderLogin();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("shows the required welcome, helper and account-mode copy", () => {
    renderLogin();
    const email = screen.getByLabelText(/email address/i);
    const password = getPasswordInput();

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to plan a shoot and see your saved plans.")).toBeInTheDocument();
    expect(screen.getByText("e.g. name@example.com")).toHaveAttribute("id", "login-email-helper");
    expect(screen.getByText("Six or more non-space characters.")).toHaveAttribute("id", "login-password-helper");
    expect(email).toHaveAttribute("aria-describedby", "login-email-helper");
    expect(password).toHaveAttribute("aria-describedby", "login-password-helper");
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create one" })).toBeInTheDocument();
  });

  it("keeps helper text associated when validation errors are shown", async () => {
    renderLogin();
    const user = userEvent.setup();
    const email = screen.getByLabelText(/email address/i);
    const password = getPasswordInput();

    await user.click(email);
    await user.tab();
    expect(email).toHaveAttribute("aria-describedby", "login-email-helper login-email-error");

    await user.click(password);
    await user.tab();
    expect(password).toHaveAttribute("aria-describedby", "login-password-helper login-password-error");
  });

  it("keeps the welcome copy and updates account-mode controls in signup mode", async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Create one" }));

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to plan a shoot and see your saved plans.")).toBeInTheDocument();
    expect(screen.getByText("Already have an account?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toHaveClass("login-submit");
  });

  it("does not show errors initially (nothing is touched)", () => {
    renderLogin();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("shows email error after blur with empty value", async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/email address/i));
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent(/email is required/i);
  });

  it("shows password error after blur with empty value", async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.click(getPasswordInput());
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /password is required/i
    );
  });

  it("calls login API and onLogin on successful sign-in", async () => {
    const mockData = {
      access_token: "test-token",
      user: { id: "u1", email: "test@example.com" },
    };
    login.mockResolvedValueOnce(mockData);
    const { onLogin } = renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email address/i), "test@example.com");
    await user.type(getPasswordInput(), "Pass123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("test@example.com", "Pass123!");
    });
    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith(mockData.user, mockData.access_token);
    });
  });

  it("shows API error on login failure", async () => {
    login.mockRejectedValueOnce(new Error("Invalid email or password."));
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email address/i), "test@example.com");
    await user.type(getPasswordInput(), "WrongPass!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid email or password/i);
    });
  });

  it("clears password after completed request", async () => {
    login.mockRejectedValueOnce(new Error("Invalid email or password."));
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email address/i), "test@example.com");
    await user.type(getPasswordInput(), "WrongPass!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(getPasswordInput()).toHaveValue("");
    });
  });

  it("uses new-password autocomplete in signup mode", async () => {
    renderLogin();
    const user = userEvent.setup();

    expect(getPasswordInput()).toHaveAttribute("autocomplete", "current-password");

    await user.click(screen.getByRole("button", { name: /create one/i }));
    expect(getPasswordInput()).toHaveAttribute("autocomplete", "new-password");
  });

  it("does not call onLogin if response is missing access_token", async () => {
    login.mockResolvedValueOnce({ user: { id: "u1", email: "e@e.com" } });
    const { onLogin } = renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email address/i), "e@e.com");
    await user.type(getPasswordInput(), "Pass123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
    });
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("toggles password visibility with an accessible pressed state", async () => {
    renderLogin();
    const user = userEvent.setup();
    const passwordInput = getPasswordInput();
    const showButton = screen.getByRole("button", { name: "Show password" });

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(showButton).toHaveAttribute("aria-pressed", "false");

    await user.click(showButton);

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("clears and hides the password when switching modes", async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.type(getPasswordInput(), "Pass123!");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    await user.click(screen.getByRole("button", { name: /create one/i }));

    expect(getPasswordInput()).toHaveValue("");
    expect(getPasswordInput()).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("authenticates immediately after successful signup", async () => {
    const mockData = {
      access_token: "signup-token",
      user: { id: "u2", email: "new@example.com" },
    };
    signup.mockResolvedValueOnce(mockData);
    const { onLogin } = renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /create one/i }));
    await user.type(screen.getByLabelText(/email address/i), "new@example.com");
    await user.type(getPasswordInput(), "Pass123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(signup).toHaveBeenCalledWith("new@example.com", "Pass123!");
      expect(onLogin).toHaveBeenCalledWith(mockData.user, mockData.access_token);
    });
  });
});

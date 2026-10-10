import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();

beforeEach(() => { vi.stubGlobal("fetch", mockFetch); });
afterEach(() => { vi.restoreAllMocks(); });

describe("savePlan API", () => {
  let savePlan, SAFE_MESSAGES;

  beforeEach(async () => {
    vi.resetModules();
    const api = await import("../utils/api");
    savePlan = api.savePlan;
    SAFE_MESSAGES = api.SAFE_MESSAGES;
  });

  it("posts allowed fields only and returns server reference", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ reference: "SP-" + "a".repeat(32) }),
    });
    const formData = {
      location: "Carlton Gardens", shootDate: "2030-06-15", startTime: "14:00",
      duration: "2 hours", shootTypes: ["Portrait"], people: "5",
      equipment: ["Camera"], lightingPlan: "", accessNotes: "Main gate on Royal Parade.", consent: true,
    };
    const result = await savePlan(formData, "tok-123");
    expect(result.reference).toBe("SP-" + "a".repeat(32));
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/plans");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer tok-123");
    const body = JSON.parse(opts.body);
    expect(body.location).toBe("Carlton Gardens");
    expect(body.consent).toBe(true);
  });

  it("throws SESSION_EXPIRED on 401", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) });
    await expect(savePlan({}, "tok" )).rejects.toThrow(SAFE_MESSAGES.SESSION_EXPIRED);
  });

  it("throws PLAN_SAVE_FAILED on 500", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });
    await expect(savePlan({}, "tok" )).rejects.toThrow(SAFE_MESSAGES.PLAN_SAVE_FAILED);
  });

  it("throws PLAN_SAVE_FAILED on 422 validation error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422, json: () => Promise.resolve({ detail: "bad" }) });
    await expect(savePlan({}, "tok" )).rejects.toThrow(SAFE_MESSAGES.PLAN_SAVE_FAILED);
  });

  it("throws NETWORK_ERROR on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(savePlan({}, "tok" )).rejects.toThrow(SAFE_MESSAGES.NETWORK_ERROR);
  });

  it("throws NETWORK_ERROR on timeout", async () => {
    const abortErr = new DOMException("Aborted", "AbortError");
    mockFetch.mockRejectedValueOnce(abortErr);
    await expect(savePlan({}, "tok" )).rejects.toThrow(SAFE_MESSAGES.NETWORK_ERROR);
  });
});

describe("fetchPlan API", () => {
  let fetchPlan, SAFE_MESSAGES;

  beforeEach(async () => {
    vi.resetModules();
    const api = await import("../utils/api");
    fetchPlan = api.fetchPlan;
    SAFE_MESSAGES = api.SAFE_MESSAGES;
  });

  it("returns plan data on success", async () => {
    const planResp = { reference: "SP-aaa", plan: { location: "Gardens" }, createdAt: "2030-01-01" };
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(planResp) });
    const result = await fetchPlan("SP-aaa", "tok");
    expect(result.reference).toBe("SP-aaa");
    expect(result.plan.location).toBe("Gardens");
  });

  it("throws PLAN_NOT_FOUND on 404", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) });
    await expect(fetchPlan("SP-x", "tok" )).rejects.toThrow(SAFE_MESSAGES.PLAN_NOT_FOUND);
  });

  it("throws SESSION_EXPIRED on 401", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) });
    await expect(fetchPlan("SP-x", "tok" )).rejects.toThrow(SAFE_MESSAGES.SESSION_EXPIRED);
  });
});
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AccessConsentScreen from "../pages/AccessConsentScreen";
import ConfirmationScreen from "../pages/ConfirmationScreen";

function renderAccess(onSubmit, onAuthExpired) {
  const data = {
    accessNotes: "Main entrance gate will be open for the crew at 6am.",
    consent: true,
    location: "Carlton Gardens", shootDate: "2030-06-15", startTime: "14:00",
    duration: "2 hours", shootTypes: ["Portrait"], people: "5",
    equipment: ["Camera"], lightingPlan: "",
  };
  let changed = { ...data };
  const onChange = (field, value) => { changed[field] = value; };
  render(
    <MemoryRouter initialEntries={["/access-consent"]}>
      <Routes>
        <Route path="/access-consent" element={
          <AccessConsentScreen data={changed} onChange={onChange} onSubmit={onSubmit} onAuthExpired={onAuthExpired || (() => {})} />
        } />
        <Route path="/confirmation" element={<div data-testid="confirm">Confirmation</div>} />
        <Route path="/" element={<div data-testid="login">Login</div>} />
      </Routes>
    </MemoryRouter>
  );
  return { changed };
}

describe("AccessConsentScreen save flow", () => {
  it("navigates to confirmation on successful save", async () => {
    const onSubmit = vi.fn().mockResolvedValue("SP-abc123");
    renderAccess(onSubmit);
    const btn = screen.getByRole("button", { name: /submit plan/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByTestId("confirm")).toBeInTheDocument();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("retrieves and renders the saved plan using the returned reference", async () => {
    const reference = "SP-retrieved-123";
    const retrievedPlan = {
      reference,
      plan: {
        location: "Retrieved location",
        shootDate: "2030-06-15",
        startTime: "14:00",
        duration: "2 hours",
        shootTypes: ["Portrait"],
        people: "5",
        equipment: ["Camera"],
        lightingPlan: "",
        accessNotes: "Retrieved access notes from the saved plan.",
      },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(retrievedPlan),
    });
    const onSubmit = vi.fn().mockResolvedValue(reference);
    const data = {
      location: "Unsaved local location",
      shootDate: "2040-01-01",
      startTime: "09:15",
      duration: "60 minutes",
      accessNotes: "Local notes should not appear after retrieval.",
      consent: true,
    };

    render(
      <MemoryRouter initialEntries={["/access-consent"]}>
        <Routes>
          <Route path="/access-consent" element={
            <AccessConsentScreen data={data} onChange={() => {}} onSubmit={onSubmit} onAuthExpired={() => {}} />
          } />
          <Route path="/confirmation" element={
            <ConfirmationScreen data={data} onReset={() => {}} accessToken="tok-retrieve" onAuthExpired={() => {}} />
          } />
        </Routes>
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: /submit plan/i }));

    expect(await screen.findByRole("heading", { name: "Shoot plan prepared." })).toBeInTheDocument();
    expect(screen.getByText("Plan complete")).toBeInTheDocument();
    expect(screen.getByText("Your plan is saved and ready. Use the reference below to access your shoot details.")).toBeInTheDocument();
    expect(screen.getByText(reference)).toBeInTheDocument();
    expect(screen.getAllByText("Retrieved location").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sat 15 Jun 2030").length).toBeGreaterThan(0);
    expect(screen.getByText("2:00 pm–4:00 pm")).toBeInTheDocument();
    expect(screen.getByText("Retrieved access notes from the saved plan.")).toBeInTheDocument();
    expect(screen.queryByText("Unsaved local location")).not.toBeInTheDocument();
    expect(screen.queryByText("Sun 1 Jan 2040")).not.toBeInTheDocument();
    expect(screen.queryByText("9:15 am–10:15 am")).not.toBeInTheDocument();
    expect(screen.queryByText("Local notes should not appear after retrieval.")).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/plans/${reference}`),
      expect.objectContaining({ headers: { Authorization: "Bearer tok-retrieve" } }),
    );
  });

  it("shows error on failed save and re-enables button", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Unable to save your plan. Please try again."));
    renderAccess(onSubmit);
    const btn = screen.getByRole("button", { name: /submit plan/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unable to save" );
    });
    expect(screen.getByRole("button", { name: /submit plan/i })).not.toBeDisabled();
  });

  it("sends only one request on double click", async () => {
    let resolveRef;
    const onSubmit = vi.fn().mockImplementation(() => new Promise((r) => { resolveRef = r; }));
    renderAccess(onSubmit);
    const btn = screen.getByRole("button", { name: /submit plan/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolveRef("SP-dup");
    await waitFor(() => {
      expect(screen.getByTestId("confirm")).toBeInTheDocument();
    });
  });

  it("clears error on new submit attempt", async () => {
    let callCount = 0;
    const onSubmit = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("Server error"));
      return Promise.resolve("SP-retry");
    });
    renderAccess(onSubmit);
    const btn = screen.getByRole("button", { name: /submit plan/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByTestId("confirm")).toBeInTheDocument();
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});


describe("AccessConsentScreen under StrictMode", () => {
  function renderStrict(onSubmit) {
    const data = { accessNotes: "Main entrance gate will be open for the crew at 6am.", consent: true };
    const onChange = () => {};
    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={["/access-consent"]}>
          <Routes>
            <Route path="/access-consent" element={
              <AccessConsentScreen data={data} onChange={onChange} onSubmit={onSubmit} onAuthExpired={() => {}} />
            } />
            <Route path="/confirmation" element={<div data-testid="confirm">Confirmation</div>} />
            <Route path="/" element={<div>Login</div>} />
          </Routes>
        </MemoryRouter>
      </React.StrictMode>
    );
  }

  it("navigates to confirmation after successful save", async () => {
    const onSubmit = vi.fn().mockResolvedValue("SP-strict-ok");
    renderStrict(onSubmit);
    const btn = screen.getByRole("button", { name: /submit plan/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByTestId("confirm")).toBeInTheDocument();
    });
    expect(onSubmit).toHaveBeenCalled();
  });

  it("shows error and re-enables button on failed save", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Server busy"));
    renderStrict(onSubmit);
    const btn = screen.getByRole("button", { name: /submit plan/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server busy");
    });
    expect(screen.getByRole("button", { name: /submit plan/i })).not.toBeDisabled();
  });
});

function renderConfirmation({
  reference = "SP-confirm-123",
  accessToken = "tok-confirm",
  onReset = vi.fn(),
  onAuthExpired = vi.fn(),
} = {}) {
  return {
    onReset,
    onAuthExpired,
    ...render(
      <MemoryRouter initialEntries={[{ pathname: "/confirmation", state: { reference } }]}>
        <Routes>
          <Route
            path="/confirmation"
            element={
              <ConfirmationScreen
                onReset={onReset}
                accessToken={accessToken}
                onAuthExpired={onAuthExpired}
              />
            }
          />
          <Route path="/shoot-details" element={<div>Shoot details reset destination</div>} />
          <Route path="/" element={<div>Login destination</div>} />
        </Routes>
      </MemoryRouter>
    ),
  };
}

const CONFIRMATION_PLAN = {
  reference: "SP-confirm-123",
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

describe("ConfirmationScreen retrieval and actions", () => {
  it("announces loading while retrieval is pending", () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    renderConfirmation();

    expect(screen.getByRole("status")).toHaveTextContent("Loading your plan...");
  });

  it("shows a safe retry state when retrieval fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("private backend detail"));
    renderConfirmation();

    expect(await screen.findByRole("heading", { name: "Unable to load plan." })).toBeInTheDocument();
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText("private backend detail")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("prints the retrieved plan and resets to shoot details", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(CONFIRMATION_PLAN),
    });
    const { onReset } = renderConfirmation();

    expect(await screen.findByRole("heading", { name: "Shoot plan prepared." })).toBeInTheDocument();
    const infoLabels = [...document.querySelectorAll(".confirmation-info-card-label")].map((node) => node.textContent);
    expect(infoLabels).toEqual(["Reference", "Location", "Date"]);
    const confirmationLogo = document.querySelector(".confirmation-topbar .confirmation-topbar-logo");
    expect(confirmationLogo).toHaveClass("brand-logo--dark");
    expect(confirmationLogo).toHaveStyle({ "--brand-size": "40px" });
    expect(confirmationLogo.querySelector(".brand-logo-mark")).toHaveAttribute(
      "src",
      expect.stringContaining("standpoint-icon-blue-transparent.png")
    );
    expect(confirmationLogo.querySelector(".brand-logo-word")).toHaveTextContent("standpoint");
    expect(document.querySelector(".confirmation-info-card-value--reference")).toHaveTextContent(CONFIRMATION_PLAN.reference);
    expect(screen.getByRole("heading", { name: "Shoot Summary" }).nextElementSibling).toHaveClass("confirmation-list");
    const actionLabels = [...document.querySelectorAll(".confirmation-actions button")].map((button) => button.textContent);
    expect(actionLabels).toEqual(["Print shoot plan", "Plan another shoot"]);
    await userEvent.click(screen.getByRole("button", { name: "Print shoot plan" }));
    expect(printSpy).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Plan another shoot" }));
    expect(onReset).toHaveBeenCalledOnce();
    expect(await screen.findByText("Shoot details reset destination")).toBeInTheDocument();
  });
});

import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AccessConsentScreen from "../pages/AccessConsentScreen";

const VALID_NOTES = "The crew will enter through the staffed east gate at 6am.";

function AccessHarness({
  initialNotes = VALID_NOTES,
  initialConsent = false,
  onSubmit = vi.fn().mockResolvedValue("SP-test"),
  onChangeSpy = vi.fn(),
}) {
  const [data, setData] = useState({
    accessNotes: initialNotes,
    consent: initialConsent,
  });

  const handleChange = (field, value) => {
    onChangeSpy(field, value);
    setData((current) => ({ ...current, [field]: value }));
  };

  return (
    <MemoryRouter initialEntries={["/access-consent"]}>
      <Routes>
        <Route
          path="/access-consent"
          element={
            <AccessConsentScreen
              data={data}
              onChange={handleChange}
              onSubmit={onSubmit}
              onAuthExpired={() => {}}
            />
          }
        />
        <Route path="/confirmation" element={<div>Confirmation</div>} />
        <Route path="/crew-equipment" element={<div>Crew and equipment</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderAccess(options = {}) {
  return render(<AccessHarness {...options} />);
}

describe("AccessConsentScreen", () => {
  it("renders the permissions header and focuses the page heading", () => {
    const { container } = renderAccess();

    expect(screen.getByText("Step 3 · Permissions")).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 1, name: "Access & Consent" });
    expect(heading).toHaveFocus();
    expect(screen.getByText("Note how you'll get on site, then confirm you have the consents you need.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Site access" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Ethical Data Use" })).toBeInTheDocument();

    const actions = container.querySelector(".form-actions--split");
    expect(container.querySelectorAll(".form-actions")).toHaveLength(1);
    expect([...actions.querySelectorAll("button")].map((button) => button.textContent.trim())).toEqual([
      "Back",
      "Submit plan",
    ]);
  });

  it("connects the access helper and range counter to the textarea", () => {
    renderAccess({ initialNotes: "  Gate access  " });

    const notes = screen.getByRole("textbox", { name: "Access notes" });
    expect(notes).toHaveAttribute("id", "access-notes");
    expect(notes).toHaveAttribute("maxlength", "300");
    expect(screen.getByText(/20–300 characters/i)).toBeInTheDocument();
    expect(screen.getByText("11 / 300")).toHaveAttribute("id", "access-notes-counter");
    expect(notes).toHaveAttribute("aria-describedby", expect.stringContaining("access-notes-helper"));
    expect(notes).toHaveAttribute("aria-describedby", expect.stringContaining("access-notes-counter"));
  });

  it("shows trimmed access-note validation and focuses the textarea first", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderAccess({ initialNotes: "  too short  ", onSubmit });

    await user.click(screen.getByRole("button", { name: /submit plan/i }));

    const notes = screen.getByRole("textbox", { name: "Access notes" });
    await waitFor(() => expect(notes).toHaveFocus());
    expect(notes).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Access notes must be at least 20 characters.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reports empty access notes after blur", async () => {
    const user = userEvent.setup();
    renderAccess({ initialNotes: "" });

    const notes = screen.getByRole("textbox", { name: "Access notes" });
    await user.click(notes);
    await user.tab();

    expect(screen.getByText("Access notes are required.")).toBeInTheDocument();
    expect(notes).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps a native checkbox keyboard-operable and exposes checked styling", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    const { container } = renderAccess({ onChangeSpy });
    const checkbox = screen.getByRole("checkbox", { name: /verified access permissions/i });

    expect(checkbox).toHaveAttribute("id", "access-consent");
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Access notes" })).toHaveFocus();
    await user.tab();
    expect(checkbox).toHaveFocus();
    await user.keyboard(" ");

    expect(onChangeSpy).toHaveBeenCalledWith("consent", true);
    expect(checkbox).toBeChecked();
    expect(checkbox.closest("label")).toHaveClass("consent-card--checked");
    expect(container.querySelector(".consent-card-visual svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("marks and focuses consent when it is the first invalid field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderAccess({ onSubmit });

    await user.click(screen.getByRole("button", { name: /submit plan/i }));

    const checkbox = screen.getByRole("checkbox", { name: /verified access permissions/i });
    await waitFor(() => expect(checkbox).toHaveFocus());
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAttribute("aria-describedby", "access-consent-error");
    expect(checkbox.closest("label")).toHaveClass("consent-card--invalid");
    expect(screen.getByRole("alert")).toHaveTextContent("You must confirm access and consent details.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("uses the shared form alert and safely resets after a save failure", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Unable to save your plan. Please try again."));
    const { container } = renderAccess({ initialConsent: true, onSubmit });

    await user.click(screen.getByRole("button", { name: /submit plan/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveClass("form-alert");
    expect(alert).toHaveTextContent("Unable to save your plan. Please try again.");
    expect(container.querySelector(".login-api-error")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit plan/i })).not.toBeDisabled();
  });

  it("uses a safe fallback for non-Error save failures", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue({ detail: "sensitive backend detail" });
    renderAccess({ initialConsent: true, onSubmit });

    await user.click(screen.getByRole("button", { name: /submit plan/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Unable to save your plan. Please try again.");
    expect(alert).not.toHaveTextContent("sensitive backend detail");
  });

  it("keeps back navigation available outside the save lifecycle", async () => {
    const user = userEvent.setup();
    renderAccess();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("Crew and equipment")).toBeInTheDocument();
  });
});

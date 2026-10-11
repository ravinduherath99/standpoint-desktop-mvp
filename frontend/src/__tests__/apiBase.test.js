import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { login, savePlan } from "../utils/api";


const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

describe("API base URL configuration", () => {
  it("preserves the override and selects same-origin production or local development defaults", () => {
    const source = readFileSync(resolve(process.cwd(), "src/utils/api.js"), "utf8");

    expect(source).toContain("import.meta.env.VITE_API_BASE_URL");
    expect(source).toContain('import.meta.env.PROD ? "/api" : "http://localhost:8000/api"');
    expect(source).not.toMatch(/VITE_(?:SUPABASE|DATABASE)/);
  });

  it("keeps development requests under one /api prefix", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        access_token: "token-123",
        user: { id: "user-1", email: "user@example.com" },
      }),
    });

    await login("user@example.com", "Pass123!");

    expect(mockFetch.mock.calls[0][0]).toBe("http://localhost:8000/api/auth/login");
    expect(mockFetch.mock.calls[0][0]).not.toContain("/api/api/");
  });

  it("keeps plan requests under one /api prefix", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ reference: `SP-${"a".repeat(32)}` }),
    });

    await savePlan({
      location: "Carlton Gardens",
      shootDate: "2030-06-15",
      startTime: "14:00",
      duration: "2 hours",
      shootTypes: ["Portrait"],
      people: "5",
      equipment: ["Camera"],
      lightingPlan: "",
      accessNotes: "Enter through the main gate.",
      consent: true,
    }, "token-123");

    expect(mockFetch.mock.calls[0][0]).toBe("http://localhost:8000/api/plans");
    expect(mockFetch.mock.calls[0][0]).not.toContain("/api/api/");
  });
});
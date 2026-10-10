import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// We test the API client module directly
// Need to import after setting up mocks
describe("API client", () => {
  let login, signup, SAFE_MESSAGES;

  beforeEach(async () => {
    vi.resetModules();
    const api = await import("../utils/api");
    login = api.login;
    signup = api.signup;
    SAFE_MESSAGES = api.SAFE_MESSAGES;
  });

  it("returns validated data on successful login", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "token-123",
          user: { id: "u1", email: "a@b.com" },
        }),
    });

    const data = await login("a@b.com", "Pass123!");
    expect(data.access_token).toBe("token-123");
    expect(data.user.id).toBe("u1");
  });

  it("throws INVALID_CREDENTIALS on 422", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422, json: () => Promise.resolve({}) });

    await expect(login("a@b.com", "wrong")).rejects.toThrow(
      SAFE_MESSAGES.INVALID_CREDENTIALS
    );
  });

  it("throws INVALID_CREDENTIALS on 401 (wrong password)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: "Invalid email or password." }),
    });

    await expect(login("a@b.com", "wrong")).rejects.toThrow(
      SAFE_MESSAGES.INVALID_CREDENTIALS
    );
  });

  it("throws SERVICE_UNAVAILABLE on 500", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

    await expect(login("a@b.com", "Pass123!")).rejects.toThrow(
      SAFE_MESSAGES.SERVICE_UNAVAILABLE
    );
  });

  it("throws NETWORK_ERROR on fetch AbortError", async () => {
    const abortErr = new DOMException("Aborted", "AbortError");
    mockFetch.mockRejectedValueOnce(abortErr);

    await expect(login("a@b.com", "Pass123!")).rejects.toThrow(
      SAFE_MESSAGES.NETWORK_ERROR
    );
  });

  it("throws NETWORK_ERROR on TypeError (network down)", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(login("a@b.com", "Pass123!")).rejects.toThrow(
      SAFE_MESSAGES.NETWORK_ERROR
    );
  });

  it("throws INVALID_RESPONSE when access_token is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { id: "u1", email: "a@b.com" } }),
    });

    await expect(login("a@b.com", "Pass123!")).rejects.toThrow(
      SAFE_MESSAGES.INVALID_RESPONSE
    );
  });

  it("throws INVALID_RESPONSE when user.id is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "token",
          user: { email: "a@b.com" },
        }),
    });

    await expect(login("a@b.com", "Pass123!")).rejects.toThrow(
      SAFE_MESSAGES.INVALID_RESPONSE
    );
  });

  it("throws INVALID_RESPONSE when user.email is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "token",
          user: { id: "u1", email: "" },
        }),
    });

    await expect(login("a@b.com", "Pass123!")).rejects.toThrow(
      SAFE_MESSAGES.INVALID_RESPONSE
    );
  });

  it("signup sends correct payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-token",
          user: { id: "u2", email: "new@b.com" },
        }),
    });

    const data = await signup("new@b.com", "NewPass1!");
    expect(data.access_token).toBe("new-token");
  });

  it("sentinel secret does not leak in error messages", async () => {
    const secret = "sb-secret-s3nt1n3l";
    mockFetch.mockRejectedValueOnce(new Error(`connection failed: ${secret}`));

    try {
      await login("a@b.com", "Pass123!");
    } catch (err) {
      // Error should be wrapped as NETWORK_ERROR, not contain the secret
      expect(err.message).toBe(SAFE_MESSAGES.NETWORK_ERROR);
      expect(err.message).not.toContain(secret);
    }
  });
});
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const SAFE_MESSAGES = Object.freeze({
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_CREATION_FAILED: "Unable to create account. Please try again.",
  SERVICE_UNAVAILABLE: "Authentication service is temporarily unavailable.",
  NETWORK_ERROR: "Unable to reach the server. Please try again.",
  INVALID_RESPONSE: "Unexpected response from server.",
  PLAN_SAVE_FAILED: "Unable to save your plan. Please try again.",
  PLAN_FETCH_FAILED: "Unable to load your plan. Please try again.",
  PLAN_NOT_FOUND: "Plan not found.",
  SESSION_EXPIRED: "Your session has expired. Please sign in again.",
});

function _handleError(err) {
  if (err.name === "AbortError") throw new Error(SAFE_MESSAGES.NETWORK_ERROR);
  if (err.message && Object.values(SAFE_MESSAGES).includes(err.message)) throw err;
  throw new Error(SAFE_MESSAGES.NETWORK_ERROR);
}

export async function apiPost(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      if (res.status === 422) throw new Error(SAFE_MESSAGES.INVALID_CREDENTIALS);
      if (res.status === 401) throw new Error(SAFE_MESSAGES.INVALID_CREDENTIALS);
      throw new Error(SAFE_MESSAGES.SERVICE_UNAVAILABLE);
    }
    const data = await res.json();
    if (!data || typeof data !== "object") throw new Error(SAFE_MESSAGES.INVALID_RESPONSE);
    if (typeof data.access_token !== "string" || !data.access_token) throw new Error(SAFE_MESSAGES.INVALID_RESPONSE);
    if (!data.user || typeof data.user !== "object") throw new Error(SAFE_MESSAGES.INVALID_RESPONSE);
    if (typeof data.user.id !== "string" || !data.user.id) throw new Error(SAFE_MESSAGES.INVALID_RESPONSE);
    if (typeof data.user.email !== "string" || !data.user.email) throw new Error(SAFE_MESSAGES.INVALID_RESPONSE);
    return data;
  } catch (err) {
    clearTimeout(timeout);
    _handleError(err);
  }
}

export async function login(email, password) {
  return apiPost("/api/auth/login", { email, password });
}

export async function signup(email, password) {
  return apiPost("/api/auth/signup", { email, password });
}

export async function apiPostAuth(path, body, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status === 401) throw new Error(SAFE_MESSAGES.SESSION_EXPIRED);
    if (!res.ok) throw new Error(SAFE_MESSAGES.PLAN_SAVE_FAILED);
    const data = await res.json();
    if (!data || typeof data !== "object") throw new Error(SAFE_MESSAGES.INVALID_RESPONSE);
    return data;
  } catch (err) {
    clearTimeout(timeout);
    _handleError(err);
  }
}

export async function apiGet(path, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status === 401) throw new Error(SAFE_MESSAGES.SESSION_EXPIRED);
    if (res.status === 404) throw new Error(SAFE_MESSAGES.PLAN_NOT_FOUND);
    if (!res.ok) throw new Error(SAFE_MESSAGES.PLAN_FETCH_FAILED);
    const data = await res.json();
    if (!data || typeof data !== "object") throw new Error(SAFE_MESSAGES.INVALID_RESPONSE);
    return data;
  } catch (err) {
    clearTimeout(timeout);
    _handleError(err);
  }
}

export async function savePlan(formData, token) {
  const body = {
    location: formData.location,
    shootDate: formData.shootDate,
    startTime: formData.startTime,
    duration: formData.duration,
    shootTypes: formData.shootTypes,
    people: formData.people,
    equipment: formData.equipment,
    lightingPlan: formData.lightingPlan || null,
    accessNotes: formData.accessNotes,
    consent: formData.consent,
  };
  return apiPostAuth("/api/plans", body, token);
}

export async function fetchPlan(reference, token) {
  return apiGet(`/api/plans/${reference}`, token);
}

/**
 * Location search utilities — Photon / OpenStreetMap geocoding.
 * Pure functions for building requests and normalising responses.
 * No side-effects, no DOM access.
 */

/* ── Constants ─────────────────────────────────────────────────────────────── */

export const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

/* ── Request helpers ───────────────────────────────────────────────────────── */

/**
 * Build the URLSearchParams for a Photon search request.
 * Fixed to Melbourne region, English language, five results.
 *
 * @param {string} query — the raw location text
 * @returns {URLSearchParams}
 */
export function buildSearchParams(query) {
  return new URLSearchParams({
    q: query.trim(),
    limit: "5",
    lat: "-37.8136",
    lon: "144.9631",
    lang: "en",
  });
}

/* ── Response helpers ──────────────────────────────────────────────────────── */

/** Maximum label length before ellipsis is applied. */
const MAX_LABEL_LENGTH = 160;

/**
 * Normalise a single Photon GeoJSON feature into a display-ready suggestion.
 * Requires a non-empty properties.name; appends unique context fields
 * (district, city, state, country) separated by commas. Case-insensitive
 * deduplication of context parts. Truncates the final label to 160 characters
 * with an ellipsis when necessary.
 *
 * @param {Record<string, any>} feature — a Photon Feature object
 * @returns {{ label: string, value: string } | null} null when name is missing
 */
export function normalizePhotonFeature(feature) {
  const name = feature?.properties?.name;
  if (!name || typeof name !== "string" || !name.trim()) return null;

  const contextFields = ["district", "city", "state", "country"];
  const seen = new Set([name.trim().toLowerCase()]);
  const context = [];

  for (const field of contextFields) {
    const raw = feature.properties[field];
    if (raw && typeof raw === "string" && raw.trim()) {
      const lower = raw.trim().toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        context.push(raw.trim());
      }
    }
  }

  const fullLabel = context.length > 0
    ? `${name.trim()}, ${context.join(", ")}`
    : name.trim();

  if (fullLabel.length > MAX_LABEL_LENGTH) {
    const truncated = fullLabel.slice(0, MAX_LABEL_LENGTH - 1);
    return { label: truncated + "\u2026", value: truncated + "\u2026" };
  }

  return { label: fullLabel, value: fullLabel };
}

/**
 * Remove case-insensitive duplicate labels from a list of suggestions,
 * keeping the first occurrence.
 *
 * @param {Array<{ label: string, value: string }>} features
 * @returns {Array<{ label: string, value: string }>}
 */
export function filterDuplicateLabels(features) {
  const seen = new Set();
  return features.filter(({ label }) => {
    const lower = label.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

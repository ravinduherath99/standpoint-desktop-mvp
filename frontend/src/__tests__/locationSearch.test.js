import { describe, it, expect } from "vitest";
import {
  PHOTON_ENDPOINT,
  OSM_COPYRIGHT_URL,
  buildSearchParams,
  normalizePhotonFeature,
  filterDuplicateLabels,
} from "../utils/locationSearch";

/* ── Constants ─────────────────────────────────────────────────────────── */

describe("locationSearch constants", () => {
  it("exports PHOTON_ENDPOINT", () => {
    expect(PHOTON_ENDPOINT).toBe("https://photon.komoot.io/api/");
  });

  it("exports OSM_COPYRIGHT_URL", () => {
    expect(OSM_COPYRIGHT_URL).toBe("https://www.openstreetmap.org/copyright");
  });
});

/* ── buildSearchParams ─────────────────────────────────────────────────── */

describe("buildSearchParams", () => {
  it("returns URLSearchParams with correct fields", () => {
    const params = buildSearchParams("Carlton Gardens");
    expect(params.get("q")).toBe("Carlton Gardens");
    expect(params.get("limit")).toBe("5");
    expect(params.get("lat")).toBe("-37.8136");
    expect(params.get("lon")).toBe("144.9631");
    expect(params.get("lang")).toBe("en");
  });

  it("trims whitespace from query", () => {
    const params = buildSearchParams("  Carlton Gardens  ");
    expect(params.get("q")).toBe("Carlton Gardens");
  });

  it("produces a valid query string", () => {
    const params = buildSearchParams("test query");
    expect(params.toString()).toContain("q=test+query");
  });
});

/* ── normalizePhotonFeature ────────────────────────────────────────────── */

describe("normalizePhotonFeature", () => {
  const makeFeature = (props) => ({
    type: "Feature",
    properties: props,
    geometry: { type: "Point", coordinates: [144, -37] },
  });

  it("returns null when properties.name is missing", () => {
    expect(normalizePhotonFeature(makeFeature({}))).toBeNull();
  });

  it("returns null when properties.name is empty string", () => {
    expect(normalizePhotonFeature(makeFeature({ name: "" }))).toBeNull();
  });

  it("returns null when properties.name is whitespace only", () => {
    expect(normalizePhotonFeature(makeFeature({ name: "   " }))).toBeNull();
  });

  it("returns null when feature has no properties", () => {
    expect(normalizePhotonFeature({ type: "Feature", properties: null })).toBeNull();
  });

  it("returns label with name only when no context", () => {
    const result = normalizePhotonFeature(makeFeature({ name: "Carlton Gardens" }));
    expect(result).toEqual({
      label: "Carlton Gardens",
      value: "Carlton Gardens",
    });
  });

  it("appends district, city, state, country", () => {
    const result = normalizePhotonFeature(
      makeFeature({
        name: "Carlton Gardens",
        district: "Carlton",
        city: "Melbourne",
        state: "Victoria",
        country: "Australia",
      })
    );
    expect(result).toEqual({
      label: "Carlton Gardens, Carlton, Melbourne, Victoria, Australia",
      value: "Carlton Gardens, Carlton, Melbourne, Victoria, Australia",
    });
  });

  it("removes duplicate context case-insensitively", () => {
    const result = normalizePhotonFeature(
      makeFeature({
        name: "melbourne",
        city: "Melbourne",
        country: "Australia",
      })
    );
    expect(result.label).toBe("melbourne, Australia");
  });

  it("skips empty context fields", () => {
    const result = normalizePhotonFeature(
      makeFeature({
        name: "Test Place",
        district: "",
        city: "Melbourne",
        state: null,
        country: "Australia",
      })
    );
    expect(result.label).toBe("Test Place, Melbourne, Australia");
  });

  it("truncates label to 160 characters with ellipsis", () => {
    const longName = "A".repeat(150);
    const result = normalizePhotonFeature(
      makeFeature({
        name: longName,
        city: "Melbourne",
        country: "Australia",
      })
    );
    expect(result.label.length).toBe(160);
    expect(result.label.endsWith("\u2026")).toBe(true);
  });

  it("does not truncate when label is exactly 160 characters", () => {
    const name = "A".repeat(160);
    const result = normalizePhotonFeature(makeFeature({ name }));
    expect(result.label.length).toBe(160);
    expect(result.label.endsWith("\u2026")).toBe(false);
  });

  it("does not truncate when label is under 160 characters", () => {
    const result = normalizePhotonFeature(makeFeature({ name: "Short" }));
    expect(result.label).toBe("Short");
    expect(result.label.endsWith("\u2026")).toBe(false);
  });
});

/* ── filterDuplicateLabels ─────────────────────────────────────────────── */

describe("filterDuplicateLabels", () => {
  it("returns empty array for empty input", () => {
    expect(filterDuplicateLabels([])).toEqual([]);
  });

  it("keeps all unique labels", () => {
    const input = [
      { label: "Carlton", value: "Carlton" },
      { label: "Melbourne", value: "Melbourne" },
    ];
    expect(filterDuplicateLabels(input)).toEqual(input);
  });

  it("removes exact duplicate labels", () => {
    const input = [
      { label: "Carlton", value: "Carlton" },
      { label: "Carlton", value: "Carlton, VIC" },
    ];
    const result = filterDuplicateLabels(input);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("Carlton");
  });

  it("removes case-insensitive duplicate labels", () => {
    const input = [
      { label: "carlton gardens", value: "carlton gardens" },
      { label: "Carlton Gardens", value: "Carlton Gardens" },
    ];
    const result = filterDuplicateLabels(input);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("carlton gardens");
  });

  it("keeps first occurrence of duplicates", () => {
    const input = [
      { label: "First", value: "first" },
      { label: "Second", value: "second" },
      { label: "first", value: "first-lower" },
    ];
    const result = filterDuplicateLabels(input);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("first");
    expect(result[1].value).toBe("second");
  });
});

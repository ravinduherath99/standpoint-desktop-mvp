import { useState, useRef, useEffect, useCallback } from "react";
import {
  PHOTON_ENDPOINT,
  OSM_COPYRIGHT_URL,
  buildSearchParams,
  normalizePhotonFeature,
  filterDuplicateLabels,
} from "../utils/locationSearch";
import ActionButton from "./ActionButton";

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 160;
const RATE_LIMIT_MS = 1000;
const TIMEOUT_MS = 8000;

/**
 * LocationSearch — optional free-form suggestions from Photon / OpenStreetMap.
 * Sits below the manual location field. Does not own or move location state.
 *
 * @param {{ location: string, onChange: Function }} props
 */
export default function LocationSearch({ location, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedValue, setSelectedValue] = useState("");

  const abortControllerRef = useRef(null);
  const lastRequestTimeRef = useRef(0);
  const timeoutRef = useRef(null);

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Clear suggestions when location text changes (but not on selection).
  // AbortController cleanup is an external-system sync; state resets are batched by React.
  // eslint-disable-next-line react/set-state-in-effect -- state must reset on prop change
  const prevLocationRef = useRef(location);
  useEffect(() => {
    if (location !== prevLocationRef.current) {
      prevLocationRef.current = location;
      if (location !== selectedValue) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        // eslint-disable-next-line react/set-state-in-effect
        setSuggestions([]);
        setSelectedValue("");
        setStatus("idle");
        setStatusMessage("");
      }
    }
  }, [location, selectedValue]);

  const handleSearch = useCallback(async () => {
    const trimmed = location.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setStatus("invalid");
      setStatusMessage("Enter at least 3 characters to search.");
      setSuggestions([]);
      return;
    }
    if (trimmed.length > MAX_QUERY_LENGTH) {
      setStatus("invalid");
      setStatusMessage("Location must be 160 characters or fewer.");
      setSuggestions([]);
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastRequestTimeRef.current < RATE_LIMIT_MS) {
      setStatus("rate-limited");
      setStatusMessage("Please wait a moment before searching again.");
      return;
    }
    lastRequestTimeRef.current = now;

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);
    timeoutRef.current = tid;

    setStatus("loading");
    setStatusMessage("Searching\u2026");
    setSuggestions([]);
    setSelectedValue("");

    try {
      const url =
        PHOTON_ENDPOINT + "?" + buildSearchParams(trimmed).toString();
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(tid);
      timeoutRef.current = null;

      if (controller.signal.aborted || abortControllerRef.current !== controller) {
        return;
      }

      if (!response.ok) {
        setStatus("unavailable");
        setStatusMessage(
          "Search service is unavailable. You can continue with your typed location."
        );
        return;
      }

      const data = await response.json();

      if (controller.signal.aborted || abortControllerRef.current !== controller) {
        return;
      }

      const normalized = (data.features || [])
        .map(normalizePhotonFeature)
        .filter(Boolean)
        .slice(0, 5);

      const unique = filterDuplicateLabels(normalized);

      if (unique.length === 0) {
        setStatus("empty");
        setStatusMessage("No suggestions found for this query.");
      } else {
        setStatus("ready");
        setStatusMessage(
          `${unique.length} result${unique.length === 1 ? "" : "s"} found. Select one or continue typing.`
        );
        setSuggestions(unique);
      }
    } catch (error) {
      clearTimeout(tid);
      timeoutRef.current = null;

      if (error.name === "AbortError") return;
      if (abortControllerRef.current !== controller) return;

      setStatus("unavailable");
      setStatusMessage(
        "Search service is unavailable. You can continue with your typed location."
      );
    }
  }, [location]);

  const handleSuggestionChange = useCallback(
    (e) => {
      const value = e.target.value;
      if (!value) return;
      setSelectedValue(value);
      onChange("location", value);
      setSuggestions([]);
      setStatus("idle");
      setStatusMessage("");
    },
    [onChange]
  );

  const isError = status === "invalid";
  const isMuted = status === "empty" || status === "unavailable";
  const isDisabled = status === "loading";

  return (
    <div className="location-search">
      <div className="location-search-actions">
        <ActionButton
          type="button"
          variant="secondary"
          loading={isDisabled}
          disabled={isDisabled}
          onClick={handleSearch}
          aria-label="Search locations"
        >
          Search locations
        </ActionButton>
      </div>

      {status !== "idle" && (
        <div
          role="status"
          aria-live="polite"
          className={`location-search-status${
            isError
              ? " location-search-status--error"
              : isMuted
                ? " location-search-status--muted"
                : ""
          }`}
        >
          {isError && (
            <span className="field-error">{statusMessage}</span>
          )}
          {!isError && statusMessage}
        </div>
      )}

      {status === "ready" && suggestions.length > 0 && (
        <div className="location-search-suggestions">
          <label htmlFor="location-suggestions" className="sr-only">
            Location suggestions
          </label>
          <select
            id="location-suggestions"
            value=""
            onChange={handleSuggestionChange}
            aria-label="Location suggestions"
          >
            <option value="" disabled>
              Choose a suggestion&hellip;
            </option>
            {suggestions.map((s) => (
              <option key={s.label} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <small className="location-search-attribution">
        Suggestions from{" "}
        <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a>
      </small>
    </div>
  );
}



import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import LocationSearch from "../components/LocationSearch";

const mockFetch = vi.fn();

function makeResponse(features, ok = true) {
  return {
    ok,
    json: () => Promise.resolve({ type: "FeatureCollection", features }),
  };
}

function makeFeature(name, context = {}) {
  return {
    type: "Feature",
    properties: { name, ...context },
    geometry: { type: "Point", coordinates: [144, -37] },
  };
}

function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderSearch(props = {}) {
  const defaults = {
    location: "Carlton Gardens",
    onChange: vi.fn(),
    ...props,
  };
  return {
    ...render(<LocationSearch {...defaults} />),
    onChange: defaults.onChange,
  };
}

describe("LocationSearch", () => {
  it("renders Search locations button", () => {
    renderSearch();
    expect(
      screen.getByRole("button", { name: "Search locations" })
    ).toBeInTheDocument();
  });

  it("does not show status region initially", () => {
    renderSearch();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders OSM attribution link", () => {
    renderSearch();
    const link = screen.getByRole("link", { name: "OpenStreetMap" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href", "https://www.openstreetmap.org/copyright"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows invalid status for query < 3 characters", () => {
    renderSearch({ location: "ab" });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Enter at least 3 characters to search."
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows invalid status for query > 160 characters", () => {
    renderSearch({ location: "a".repeat(161) });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Location must be 160 characters or fewer."
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows loading then results on success", async () => {
    const features = [
      makeFeature("Carlton Gardens", { city: "Melbourne", country: "Australia" }),
    ];
    const deferred = createDeferred();
    mockFetch.mockReturnValueOnce(deferred.promise);

    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));
    expect(screen.getByRole("status")).toHaveTextContent("Searching\u2026");

    await act(async () => {
      deferred.resolve(makeResponse(features));
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("1 result found.");
    });
    expect(screen.getByLabelText("Location suggestions")).toBeInTheDocument();
    expect(
      screen.getByText("Carlton Gardens, Melbourne, Australia")
    ).toBeInTheDocument();
  });

  it("disables button while loading", async () => {
    const deferred = createDeferred();
    mockFetch.mockReturnValueOnce(deferred.promise);

    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));
    expect(
      screen.getByRole("button", { name: "Search locations" })
    ).toBeDisabled();

    await act(async () => {
      deferred.resolve(makeResponse([]));
    });
  });

  it("shows empty state when no features returned", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([]));

    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "No suggestions found for this query."
      );
    });
    expect(screen.queryByLabelText("Location suggestions")).not.toBeInTheDocument();
  });

  it("shows unavailable when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([], false));

    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("unavailable");
    });
  });

  it("shows unavailable when fetch throws network error", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("fail"));

    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("unavailable");
    });
  });

  it("ignores AbortError silently", async () => {
    const deferred = createDeferred();
    mockFetch.mockReturnValueOnce(deferred.promise);

    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    await act(async () => {
      deferred.reject(new DOMException("Aborted", "AbortError"));
    });

    const status = screen.queryByRole("status");
    if (status) {
      expect(status).not.toHaveTextContent("unavailable");
    }
  });

  it("calls onChange when suggestion selected", async () => {
    const features = [
      makeFeature("Carlton Gardens", { city: "Melbourne", country: "Australia" }),
    ];
    mockFetch.mockResolvedValueOnce(makeResponse(features));

    const { onChange } = renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Location suggestions")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Location suggestions"), {
      target: { value: "Carlton Gardens, Melbourne, Australia" },
    });

    expect(onChange).toHaveBeenCalledWith(
      "location",
      "Carlton Gardens, Melbourne, Australia"
    );
  });

  it("clears suggestions after selection", async () => {
    const features = [
      makeFeature("Carlton Gardens", { city: "Melbourne", country: "Australia" }),
    ];
    mockFetch.mockResolvedValueOnce(makeResponse(features));

    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Location suggestions")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Location suggestions"), {
      target: { value: "Carlton Gardens, Melbourne, Australia" },
    });

    expect(screen.queryByLabelText("Location suggestions")).not.toBeInTheDocument();
  });

  it("rate-limits second click within 1000ms", async () => {
    mockFetch.mockResolvedValue(makeResponse([]));

    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Please wait a moment before searching again."
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("live status has role=status and aria-live=polite", () => {
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("role", "status");
  });

  it("suggestion select has accessible label", async () => {
    const features = [makeFeature("Test Place")];
    mockFetch.mockResolvedValueOnce(makeResponse(features));

    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Location suggestions")).toBeInTheDocument();
    });
  });
});

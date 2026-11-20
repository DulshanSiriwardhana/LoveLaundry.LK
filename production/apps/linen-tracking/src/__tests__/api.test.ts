import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE, TOKEN_STORAGE_KEY, buildRequestHeaders, getAuthToken } from "../api";

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

beforeEach(() => {
  localStorageMock.getItem.mockReset();
  vi.stubGlobal("window", {
    localStorage: localStorageMock,
    location: { assign: vi.fn() },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api request helpers", () => {
  it("uses the configured base URL or the /api fallback", () => {
    expect(API_BASE).toBe(import.meta.env.VITE_API_BASE_URL ?? "/api");
  });

  it("adds a bearer token header when a token is stored", () => {
    localStorageMock.getItem.mockReturnValue("test-token");
    expect(getAuthToken()).toBe("test-token");
    expect(localStorageMock.getItem).toHaveBeenCalledWith(TOKEN_STORAGE_KEY);
    expect(buildRequestHeaders()).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    });
  });

  it("omits the auth header when no token is stored", () => {
    localStorageMock.getItem.mockReturnValue(null);
    expect(buildRequestHeaders()).toEqual({ "Content-Type": "application/json" });
  });
});

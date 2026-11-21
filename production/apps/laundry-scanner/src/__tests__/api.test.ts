import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE,
  TOKEN_STORAGE_KEY,
  buildRequestHeaders,
  completeScanSession,
  fetchLaundryDashboard,
  getAuthToken,
  startScanSession,
} from "../api";

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

  it("starts and completes bulk scan sessions on the real endpoints", async () => {
    localStorageMock.getItem.mockReturnValue("test-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ session_id: "session-1", status: "ACTIVE" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ session: { status: "COMPLETED" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const started = await startScanSession({
      session_id: "session-1",
      organization_id: "laundry-a",
      action: "receive_at_laundry",
      reader_id: "reader-1",
      expected_linen_ids: ["BED-000001"],
    });
    expect(started.status).toBe("ACTIVE");

    const completed = await completeScanSession("session-1");
    expect(completed).toEqual({ session: { status: "COMPLETED" } });

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/scan/sessions`);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${API_BASE}/scan/sessions/session-1/complete`,
    );
  });

  it("requests laundry-scoped dashboard figures", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ in_washing: 7 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchLaundryDashboard("laundry-a");
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/dashboards/laundry?organization_id=laundry-a`,
      expect.anything(),
    );
  });
});

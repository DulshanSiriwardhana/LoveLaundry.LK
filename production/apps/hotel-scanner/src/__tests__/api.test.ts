import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE,
  TOKEN_STORAGE_KEY,
  buildRequestHeaders,
  fetchHotelDashboard,
  getAuthToken,
  submitReaderReads,
  submitScan,
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

  it("submits QR and EPC scans through the shared transaction endpoint", async () => {
    localStorageMock.getItem.mockReturnValue("test-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: "accepted", linen_id: "BED-000001" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitScan({
      scan_id: "hotel-scan-1",
      identifier: "303975FD591BA93D00000001",
      method: "rfid",
      action: "dispatch_from_client",
      organization_id: "hotel-a",
    });
    expect(result.linen_id).toBe("BED-000001");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/scan/transactions`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ method: "rfid" });
  });

  it("uses reader credentials for bulk RFID observations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ detected_items: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitReaderReads(
      "session-1",
      [{ epc: "303975FD591BA93D00000001" }],
      "reader-1",
      "reader-secret",
    );
    expect(result.detected_items).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/scan/sessions/session-1/reads`);
    expect(init.headers).toMatchObject({
      "X-Reader-ID": "reader-1",
      "X-Reader-Key": "reader-secret",
    });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("requests hotel-scoped dashboard figures", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ owned_inventory: 4 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchHotelDashboard("hotel-a");
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/dashboards/hotel?organization_id=hotel-a`,
      expect.anything(),
    );
  });
});

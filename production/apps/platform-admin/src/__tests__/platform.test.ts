import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE,
  PLATFORM_TOKEN_KEY,
  PLATFORM_USER_KEY,
  buildPlatformHeaders,
  fetchPlatformDashboard,
  fetchPlatformSummary,
  listTagItems,
  registerReader,
  saveAnnouncement,
} from "../api";
import { decodeTokenClaims, isPlatformAdmin, type SessionUser } from "../auth";

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

function tokenFor(claims: Record<string, unknown>): string {
  return `header.${btoa(JSON.stringify(claims))}.signature`;
}

beforeEach(() => {
  localStorageMock.getItem.mockReset();
  localStorageMock.setItem.mockReset();
  localStorageMock.removeItem.mockReset();
  vi.stubGlobal("window", {
    localStorage: localStorageMock,
    location: { assign: vi.fn() },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("platform admin authorization gate", () => {
  it("rejects tenant and anonymous sessions", () => {
    const user: SessionUser = { user_name: "manager", role_ids: ["MANAGER"] };
    expect(isPlatformAdmin(user, tokenFor({ role: "MANAGER" }))).toBe(false);
    expect(isPlatformAdmin(null, null)).toBe(false);
  });

  it("accepts a signed-in platform administrator", () => {
    const user: SessionUser = { user_name: "root", role_ids: ["PLATFORM_ADMIN"] };
    const token = tokenFor({ role: "PLATFORM_ADMIN" });
    expect(decodeTokenClaims(token).role).toBe("PLATFORM_ADMIN");
    expect(isPlatformAdmin(user, token)).toBe(true);
  });
});

describe("platform API access", () => {
  it("calls the real summary endpoint with the stored bearer token", async () => {
    localStorageMock.getItem.mockImplementation((key: string) =>
      key === PLATFORM_TOKEN_KEY ? "platform-token" : null,
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ counts: { users: 2 }, audit_entries: 3 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const summary = await fetchPlatformSummary();
    expect(summary.counts.users).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/platform/summary`, {
      headers: expect.objectContaining({ Authorization: "Bearer platform-token" }),
    });
  });

  it("posts announcement changes to the platform endpoint", async () => {
    localStorageMock.getItem.mockReturnValue("platform-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ announcement_id: "ann-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const saved = await saveAnnouncement({ title: "Notice", body: "Details" });
    expect(saved.announcement_id).toBe("ann-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/platform/announcements`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ title: "Notice" });
    expect(buildPlatformHeaders()).toMatchObject({ Authorization: "Bearer platform-token" });
  });

  it("reads the operations dashboard from the authoritative API", async () => {
    localStorageMock.getItem.mockReturnValue("platform-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ total_linen_items: 12 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect((await fetchPlatformDashboard()).total_linen_items).toBe(12);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/dashboards/platform`, {
      headers: expect.objectContaining({ Authorization: "Bearer platform-token" }),
    });
  });

  it("filters tag identities by organization", async () => {
    localStorageMock.getItem.mockReturnValue("platform-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await listTagItems(50, "hotel-a");
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/tags/items?limit=50&organization_id=hotel-a`,
      expect.anything(),
    );
  });

  it("registers readers through the hardware endpoint", async () => {
    localStorageMock.getItem.mockReturnValue("platform-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ reader_id: "reader-1", status: "ACTIVE" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const reader = await registerReader({
      reader_id: "reader-1",
      organization_id: "hotel-a",
      name: "Dock",
      adapter: "zebra",
      transport: "tcp",
      endpoint: "reader.local:4001",
    });
    expect(reader.reader_id).toBe("reader-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/rfid/readers`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ adapter: "zebra" });
  });

  it("does not expose a session without both token and user", async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === PLATFORM_TOKEN_KEY) {
        return "platform-token";
      }
      if (key === PLATFORM_USER_KEY) {
        return null;
      }
      return null;
    });
    const { getPlatformSession } = await import("../auth");
    expect(getPlatformSession()).toBeNull();
  });
});

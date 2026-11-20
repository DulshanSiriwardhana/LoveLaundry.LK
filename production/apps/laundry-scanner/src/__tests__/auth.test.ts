import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from "../api";
import { actorId, getSession, logout } from "../auth";

const values = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => values.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    values.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    values.delete(key);
  }),
};

beforeEach(() => {
  values.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  vi.stubGlobal("window", {
    localStorage: localStorageMock,
    location: { assign: vi.fn() },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("session helpers", () => {
  it("returns null when no session is stored", () => {
    expect(getSession()).toBeNull();
  });

  it("throws when actorId is called without a session", () => {
    expect(() => actorId()).toThrow("No signed-in session");
  });

  it("uses the auth id of the stored session", () => {
    values.set(TOKEN_STORAGE_KEY, "test-token");
    values.set(USER_STORAGE_KEY, JSON.stringify({ auth_id: "auth-7", user_name: "manager" }));
    expect(actorId()).toBe("auth-7");
    expect(getSession()).toMatchObject({ user_name: "manager" });
  });

  it("clears the token and the user on logout", () => {
    values.set(TOKEN_STORAGE_KEY, "test-token");
    values.set(USER_STORAGE_KEY, JSON.stringify({ auth_id: "auth-7", user_name: "manager" }));
    logout();
    expect(values.has(TOKEN_STORAGE_KEY)).toBe(false);
    expect(values.has(USER_STORAGE_KEY)).toBe(false);
  });
});

import {
  API_BASE,
  PLATFORM_TOKEN_KEY,
  PLATFORM_USER_KEY,
  clearPlatformSession,
  getPlatformToken,
} from "./api";

export interface SessionUser {
  auth_id?: string;
  user_name: string;
  status?: string;
  role?: string;
  role_ids?: string[];
  permissions?: string[];
  platform_admin?: boolean;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: SessionUser;
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

export async function platformLogin(
  userName: string,
  password: string,
): Promise<SessionUser> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_name: userName, password }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(
      typeof detail?.detail === "string"
        ? detail.detail
        : `Login failed with status ${response.status}`,
    );
  }
  const payload = (await response.json()) as LoginResponse;
  if (!payload.access_token || !payload.user?.user_name) {
    throw new Error("Login response did not include an access token and user.");
  }
  const storage = browserStorage();
  if (!storage) {
    throw new Error("Browser storage is unavailable; cannot start a session.");
  }
  storage.setItem(PLATFORM_TOKEN_KEY, payload.access_token);
  storage.setItem(PLATFORM_USER_KEY, JSON.stringify(payload.user));
  return payload.user;
}

export function getPlatformSession(): SessionUser | null {
  const storage = browserStorage();
  const token = getPlatformToken();
  const rawUser = storage?.getItem(PLATFORM_USER_KEY);
  if (!token || !rawUser) {
    return null;
  }
  try {
    const user = JSON.parse(rawUser) as SessionUser;
    if (!user || typeof user.user_name !== "string" || !user.user_name) {
      clearPlatformSession();
      return null;
    }
    return user;
  } catch {
    clearPlatformSession();
    return null;
  }
}

export function decodeTokenClaims(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) {
    return {};
  }
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function names(value: unknown): string[] {
  if (typeof value === "string") {
    return [value.toUpperCase()];
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.toUpperCase() : ""))
      .filter(Boolean);
  }
  return [];
}

export function isPlatformAdmin(user: SessionUser | null, token: string | null): boolean {
  if (!user || !token) {
    return false;
  }
  const claims = decodeTokenClaims(token);
  const roles = new Set([
    ...names(user.role),
    ...names(user.role_ids),
    ...names(claims.role),
    ...names(claims.role_ids),
  ]);
  const permissions = new Set([
    ...names(user.permissions),
    ...names(claims.permissions),
  ]);
  return (
    user.platform_admin === true ||
    claims.platform_admin === true ||
    roles.has("PLATFORM_ADMIN") ||
    permissions.has("PLATFORM_ADMIN") ||
    permissions.has("PLATFORM_ADMIN_ACCESS")
  );
}

export function platformLogout(): void {
  clearPlatformSession();
}

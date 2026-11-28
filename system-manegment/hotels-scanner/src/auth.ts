import { API_BASE, TOKEN_STORAGE_KEY, USER_STORAGE_KEY, buildRequestHeaders } from "./api";

export interface SessionUser {
  auth_id?: string;
  user_name: string;
  status?: string;
  role_ids?: string[];
  permissions?: string[];
  organization_id?: string;
  laundry_id?: string;
  hotel_id?: string;
  shop_id?: string;
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

export function getSession(): SessionUser | null {
  const storage = browserStorage();
  if (!storage) {
    return null;
  }
  const token = storage.getItem(TOKEN_STORAGE_KEY);
  const rawUser = storage.getItem(USER_STORAGE_KEY);
  if (!token || !rawUser) {
    return null;
  }
  try {
    const user = JSON.parse(rawUser) as SessionUser;
    if (!user || typeof user !== "object" || typeof user.user_name !== "string" || !user.user_name) {
      logout();
      return null;
    }
    return user;
  } catch {
    logout();
    return null;
  }
}

export async function login(userName: string, password: string): Promise<SessionUser> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: buildRequestHeaders(),
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
  if (!payload?.access_token || !payload?.user?.user_name) {
    throw new Error("Login response did not include an access token and user.");
  }

  const storage = browserStorage();
  if (!storage) {
    throw new Error("Browser storage is unavailable; cannot start a session.");
  }
  storage.setItem(TOKEN_STORAGE_KEY, payload.access_token);
  storage.setItem(USER_STORAGE_KEY, JSON.stringify(payload.user));
  return payload.user;
}

export function logout(): void {
  const storage = browserStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(TOKEN_STORAGE_KEY);
  storage.removeItem(USER_STORAGE_KEY);
}

export function actorId(): string {
  const session = getSession();
  if (!session) {
    throw new Error("No signed-in session. Sign in before recording an action.");
  }
  const id = session.auth_id ?? session.user_name;
  if (!id) {
    throw new Error("Signed-in user has no auth_id or user_name.");
  }
  return id;
}

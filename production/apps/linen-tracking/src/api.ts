export interface LinenOperations {
  period: string;
  received: number;
  delivered: number;
  net: number;
}

export interface Movement {
  movement_id: string;
  linen_id: string;
  direction: string;
  quantity: number;
  from_org: string;
  to_org: string;
  period: string;
  reason: string;
  actor_id: string;
}

export interface MovementPayload {
  movement_id: string;
  linen_id: string;
  direction: "in" | "out";
  quantity: number;
  from_org: string;
  to_org: string;
  reason: string;
  period: string;
  actor_id: string;
}

export const TOKEN_STORAGE_KEY = "lovelaundry_token";
export const USER_STORAGE_KEY = "lovelaundry_user";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * A 401 from one backend service is NOT proof that the user's session ended.
 * Only end the session when the token actually sent is missing or clearly
 * expired; otherwise surface the error and keep the user signed in.
 */
const SESSION_EXPIRED_EVENT = "ll:session-expired";
const CLOCK_SKEW_MS = 60_000;

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const parts = token.split(".");
  if (parts.length < 2) return false;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { exp?: unknown };
    if (typeof payload?.exp !== "number" || !Number.isFinite(payload.exp)) return false;
    return payload.exp * 1000 < Date.now() - CLOCK_SKEW_MS;
  } catch {
    return false;
  }
}

export function buildRequestHeaders(headers?: HeadersInit): Record<string, string> {
  const merged: Record<string, string> = {
    "Content-Type": "application/json",
    ...((headers ?? {}) as Record<string, string>),
  };
  const token = getAuthToken();
  if (token && !("Authorization" in merged)) {
    merged.Authorization = `Bearer ${token}`;
  }
  return merged;
}

function handleUnauthorized(): void {
  if (typeof window === "undefined") {
    return;
  }
  // A healthy JWT receiving a 401 means a service/permission problem, not a
  // signed-out user. Logging out there caused random sign-outs after login
  // or on the next click.
  if (!isTokenExpired(getAuthToken())) return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildRequestHeaders(init?.headers),
    body: init?.body ? String(init.body) : undefined,
  });

  if (response.status === 401) {
    handleUnauthorized();
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchLinenOperations(period: string): Promise<LinenOperations> {
  return request<LinenOperations>(`/linen/operations?period=${encodeURIComponent(period)}`);
}

export function recordLinenMovement(movement: MovementPayload): Promise<Movement> {
  return request<Movement>("/linen/movements", {
    method: "POST",
    body: JSON.stringify(movement),
  });
}

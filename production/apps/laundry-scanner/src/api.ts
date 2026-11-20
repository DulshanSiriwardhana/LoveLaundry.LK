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
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.location.assign("/login");
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

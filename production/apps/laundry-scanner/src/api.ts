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

const API_BASE = "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: init?.body ? String(init.body) : undefined,
  });

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

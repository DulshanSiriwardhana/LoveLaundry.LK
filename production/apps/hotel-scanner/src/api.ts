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

export type ScanMethod = "qr" | "epc" | "rfid";

export interface ScanTransactionPayload {
  scan_id: string;
  identifier: string;
  method: ScanMethod;
  action: string;
  organization_id: string;
  to_organization_id?: string;
  scanner_id?: string;
  reader_id?: string;
  session_id?: string;
  batch_id?: string;
  location?: string;
  correlation_id?: string;
  workflow_reference?: string;
}

export interface ScanResult {
  result: string;
  duplicate?: boolean;
  scan_id?: string;
  linen_id?: string;
  stage?: string;
  wash_count?: number;
  message?: string;
}

/** Distinct/verification view of one scanned tag (GET /linen/items/{id}). */
export interface LinenVerification {
  linen_id: string;
  category?: string;
  item_type?: string;
  description?: string;
  size?: string;
  client_name?: string;
  status?: string;
  current_stage?: string;
}

/** One admin-defined allowed move, from the shared scan catalogue. */
export interface TransitionRule {
  from_status: string;
  to_statuses: string[];
}

export interface TransitionCatalogue {
  statuses: string[];
  transition_rules: TransitionRule[];
  violation_mode: "block" | "warn";
}

/** GET a single linen profile without mutating its scan state. */
export function verifyLinen(linenId: string): Promise<LinenVerification> {
  return request<LinenVerification>(
    `/linen/items/${encodeURIComponent(linenId)}`,
  );
}

/** Best-effort catalogue for the UI. Older backends return 404; callers fall
 * back to a sensible local catalogue so scanning still works. */
export function getTransitionCatalogue(): Promise<TransitionCatalogue> {
  return request<TransitionCatalogue>("/linens/transitions");
}

export interface MissingAlertRow {
  alert_id: string;
  linen_id: string;
  organization_id?: string;
  severity?: string;
  status?: string;
  days_since_last_seen?: number;
  current_stage?: string;
}

export interface LinenProfileRow {
  linen_id: string;
  organization_id?: string;
  current_stage?: string;
  status?: string;
  wash_count?: number;
  last_seen_at?: string;
}

export interface ScanSessionRow {
  session_id: string;
  organization_id?: string;
  action?: string;
  stage?: string;
  status?: string;
  reader_id?: string;
  expected_count?: number;
  detected_count?: number;
  duplicate_count?: number;
  missing_count?: number;
  unexpected_count?: number;
}

export function newScanId(prefix = "SCAN"): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function submitScan(payload: ScanTransactionPayload): Promise<ScanResult> {
  return request<ScanResult>("/scan/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchHotelDashboard(organizationId = ""): Promise<Record<string, unknown>> {
  const query = organizationId
    ? `?organization_id=${encodeURIComponent(organizationId)}`
    : "";
  return request<Record<string, unknown>>(`/dashboards/hotel${query}`);
}

export function fetchMissingAlerts(organizationId = ""): Promise<MissingAlertRow[]> {
  const query = organizationId
    ? `?organization_id=${encodeURIComponent(organizationId)}`
    : "";
  return request<MissingAlertRow[]>(`/linen/alerts${query}`);
}

export function resolveMissingAlert(alertId: string): Promise<MissingAlertRow> {
  return request<MissingAlertRow>(`/linen/alerts/${encodeURIComponent(alertId)}/resolve`, {
    method: "POST",
  });
}

export function listLinenProfiles(organizationId = ""): Promise<LinenProfileRow[]> {
  const params = new URLSearchParams({ limit: "200" });
  if (organizationId) {
    params.set("organization_id", organizationId);
  }
  return request<LinenProfileRow[]>(`/linen/items?${params.toString()}`);
}

export function listScanSessions(): Promise<ScanSessionRow[]> {
  return request<ScanSessionRow[]>("/scan/sessions");
}

export function getScanSession(sessionId: string): Promise<ScanSessionRow> {
  return request<ScanSessionRow>(`/scan/sessions/${encodeURIComponent(sessionId)}`);
}

export function reconcileScanSession(sessionId: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(
    `/scan/sessions/${encodeURIComponent(sessionId)}/reconcile`,
  );
}

async function readerRequest<T>(
  path: string,
  readerId: string,
  readerKey: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Reader-ID": readerId,
      "X-Reader-Key": readerKey,
      ...((init?.headers ?? {}) as Record<string, string>),
    },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Reader request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export function submitReaderReads(
  sessionId: string,
  reads: Array<Record<string, unknown>>,
  readerId: string,
  readerKey: string,
): Promise<Record<string, unknown>> {
  return readerRequest(
    `/scan/sessions/${encodeURIComponent(sessionId)}/reads`,
    readerId,
    readerKey,
    { method: "POST", body: JSON.stringify({ reads }) },
  );
}

export function captureReaderReads(
  sessionId: string,
  readerId: string,
  readerKey: string,
  duration = 2,
): Promise<Record<string, unknown>> {
  return readerRequest(
    `/scan/sessions/${encodeURIComponent(sessionId)}/capture?duration=${duration}`,
    readerId,
    readerKey,
    { method: "POST" },
  );
}

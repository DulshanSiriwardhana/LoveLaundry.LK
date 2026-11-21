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

export interface MissingAlertRow {
  alert_id: string;
  linen_id: string;
  organization_id?: string;
  severity?: string;
  status?: string;
  days_since_last_seen?: number;
  current_stage?: string;
}

export interface TagAlertRow {
  linen_id?: string;
  organization_id?: string;
  signal?: string;
  severity?: string;
  wash_count?: number;
  message?: string;
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

export interface StartSessionPayload {
  session_id: string;
  organization_id: string;
  action: string;
  reader_id: string;
  expected_linen_ids?: string[];
  expected_count?: number;
  mode?: string;
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

export function fetchLaundryDashboard(organizationId = ""): Promise<Record<string, unknown>> {
  const query = organizationId
    ? `?organization_id=${encodeURIComponent(organizationId)}`
    : "";
  return request<Record<string, unknown>>(`/dashboards/laundry${query}`);
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

export function fetchTagAlerts(): Promise<TagAlertRow[]> {
  return request<TagAlertRow[]>("/tags/health/alerts");
}

export function listScanSessions(): Promise<ScanSessionRow[]> {
  return request<ScanSessionRow[]>("/scan/sessions");
}

export function getScanSession(sessionId: string): Promise<ScanSessionRow> {
  return request<ScanSessionRow>(`/scan/sessions/${encodeURIComponent(sessionId)}`);
}

export function startScanSession(payload: StartSessionPayload): Promise<ScanSessionRow> {
  return request<ScanSessionRow>("/scan/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeScanSession(sessionId: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(
    `/scan/sessions/${encodeURIComponent(sessionId)}/complete`,
    { method: "POST" },
  );
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

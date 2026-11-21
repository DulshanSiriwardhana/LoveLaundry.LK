export interface PlatformSummary {
  counts: Record<string, number>;
  audit_entries: number;
}

export interface OrganizationRow {
  organization_id: string;
  name: string;
  type: string;
  status: string;
}

export interface AnnouncementRow {
  announcement_id?: string;
  title: string;
  body: string;
  applications?: string[];
  organization_ids?: string[];
  role_names?: string[];
  priority?: string;
  starts_at?: string;
  ends_at?: string;
  enabled?: boolean;
}

export interface ThemeRow {
  settings_id?: string;
  scope: string;
  organization_id?: string;
  theme: Record<string, unknown>;
  status?: string;
  scheduled_for?: string;
  expires_at?: string;
}

export interface AuditRow {
  audit_id: string;
  event_id: string;
  event_type: string;
  organization_id?: string;
  actor_id?: string;
  entity_id?: string;
  source?: string;
  occurred_at: string;
  recorded_at: string;
}

export interface TagItem {
  linen_id: string;
  organization_id?: string;
  item_type?: string;
  category?: string;
  qr_id?: string;
  qr_url?: string;
  epc?: string;
  tag_serial?: string;
  status?: string;
  tag_status?: string;
  wash_count?: number;
}

export interface TagAlert {
  linen_id?: string;
  organization_id?: string;
  signal?: string;
  severity?: string;
  wash_count?: number;
  message?: string;
}

export interface ReaderRow {
  reader_id: string;
  organization_id?: string;
  name?: string;
  adapter?: string;
  transport?: string;
  endpoint?: string;
  status?: string;
  revoked?: boolean;
  last_heartbeat_at?: string;
}

export interface CompatibilityRow {
  adapter: string;
  technologies?: string[];
  transports?: string[];
  production_ready?: boolean;
  notes?: string;
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
  started_at?: string;
  completed_at?: string;
}

export interface CreateTagPayload {
  organization_id: string;
  item_type: string;
  category: string;
  size?: string;
  material?: string;
  batch_id?: string;
}

export interface RegisterReaderPayload {
  reader_id: string;
  organization_id: string;
  name: string;
  adapter: string;
  transport: string;
  endpoint: string;
  region?: string;
  frequency_mhz?: number;
  metadata?: Record<string, unknown>;
}

export const PLATFORM_TOKEN_KEY = "lovelaundry_platform_token";
export const PLATFORM_USER_KEY = "lovelaundry_platform_user";
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

function browserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

export function getPlatformToken(): string | null {
  return browserStorage()?.getItem(PLATFORM_TOKEN_KEY) ?? null;
}

export function clearPlatformSession(): void {
  const storage = browserStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(PLATFORM_TOKEN_KEY);
  storage.removeItem(PLATFORM_USER_KEY);
}

export function buildPlatformHeaders(headers?: HeadersInit): Record<string, string> {
  const merged: Record<string, string> = {
    "Content-Type": "application/json",
    ...((headers ?? {}) as Record<string, string>),
  };
  const token = getPlatformToken();
  if (token && !("Authorization" in merged)) {
    merged.Authorization = `Bearer ${token}`;
  }
  return merged;
}

export async function platformRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildPlatformHeaders(init?.headers),
  });
  if (response.status === 401) {
    clearPlatformSession();
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(
      typeof detail?.detail === "string"
        ? detail.detail
        : `Platform request failed with status ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

export function fetchPlatformSummary(): Promise<PlatformSummary> {
  return platformRequest<PlatformSummary>("/platform/summary");
}

export function fetchPlatformOrganizations(): Promise<OrganizationRow[]> {
  return platformRequest<OrganizationRow[]>("/platform/organizations");
}

export function fetchPlatformAnnouncements(): Promise<AnnouncementRow[]> {
  return platformRequest<AnnouncementRow[]>("/platform/announcements");
}

export function fetchPlatformThemes(): Promise<ThemeRow[]> {
  return platformRequest<ThemeRow[]>("/platform/themes");
}

export function fetchPlatformAudit(limit = 200): Promise<AuditRow[]> {
  return platformRequest<AuditRow[]>(`/platform/audit?limit=${limit}`);
}

export function saveAnnouncement(payload: AnnouncementRow): Promise<AnnouncementRow> {
  return platformRequest<AnnouncementRow>("/platform/announcements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveTheme(payload: ThemeRow): Promise<ThemeRow> {
  return platformRequest<ThemeRow>("/platform/themes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchPlatformDashboard(): Promise<Record<string, unknown>> {
  return platformRequest<Record<string, unknown>>("/dashboards/platform");
}

export function fetchHotelDashboard(organizationId: string): Promise<Record<string, unknown>> {
  const query = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : "";
  return platformRequest<Record<string, unknown>>(`/dashboards/hotel${query}`);
}

export function fetchLaundryDashboard(organizationId: string): Promise<Record<string, unknown>> {
  const query = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : "";
  return platformRequest<Record<string, unknown>>(`/dashboards/laundry${query}`);
}

export function listTagItems(limit = 200, organizationId = ""): Promise<TagItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (organizationId) {
    params.set("organization_id", organizationId);
  }
  return platformRequest<TagItem[]>(`/tags/items?${params.toString()}`);
}

export function createTagItem(payload: CreateTagPayload): Promise<TagItem> {
  return platformRequest<TagItem>("/tags/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchTagAlerts(): Promise<TagAlert[]> {
  return platformRequest<TagAlert[]>("/tags/health/alerts");
}

export function listReaders(): Promise<ReaderRow[]> {
  return platformRequest<ReaderRow[]>("/rfid/readers");
}

export function registerReader(payload: RegisterReaderPayload): Promise<ReaderRow> {
  return platformRequest<ReaderRow>("/rfid/readers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function revokeReader(readerId: string): Promise<{ reader_id: string; status: string }> {
  return platformRequest(`/rfid/readers/${encodeURIComponent(readerId)}`, {
    method: "DELETE",
  });
}

export function fetchReaderCompatibility(): Promise<CompatibilityRow[]> {
  return platformRequest<CompatibilityRow[]>("/rfid/compatibility");
}

export function listScanSessions(): Promise<ScanSessionRow[]> {
  return platformRequest<ScanSessionRow[]>("/scan/sessions");
}

export function reconcileScanSession(sessionId: string): Promise<Record<string, unknown>> {
  return platformRequest(`/scan/sessions/${encodeURIComponent(sessionId)}/reconcile`);
}

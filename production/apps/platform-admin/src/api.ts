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

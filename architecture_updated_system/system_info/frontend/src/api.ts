// Typed API client for the bounded system_info scanner service.
const BASE = import.meta.env.VITE_SCANNER_API_URL ?? "";
const API_KEY = import.meta.env.VITE_SCANNER_API_KEY ?? "";

function headers(): HeadersInit {
  return API_KEY ? { "X-Scan-Api-Key": API_KEY } : {};
}

export interface Route {
  method: string;
  path: string;
  file: string;
}

export interface ServiceSummary {
  name: string;
  language: string;
  framework: string;
  mount_prefix: string;
  route_count: number;
  python_files: number;
  env_var_names: string[];
  entrypoints: string[];
}

export interface ServiceDetail extends ServiceSummary {
  routes: Route[];
  dependencies: string[];
}

export interface Summary {
  source_root: string;
  service_count: number;
  route_count: number;
  services: ServiceSummary[];
}

export interface DependencyGraph {
  nodes: string[];
  edges: { from: string; to: string; via: string }[];
}

export interface Health {
  status: string;
  version: string;
  source_root: string;
  source_available: boolean;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  health: () => get<Health>("/health"),
  summary: () => get<Summary>("/api/summary"),
  services: () => get<ServiceSummary[]>("/api/services"),
  service: (name: string) => get<ServiceDetail>(`/api/services/${encodeURIComponent(name)}`),
  dependencies: () => get<DependencyGraph>("/api/dependencies"),
  async rescan(): Promise<Summary> {
    const res = await fetch(`${BASE}/api/scan`, { method: "POST", headers: headers() });
    if (!res.ok) throw new Error(`scan failed: ${res.status}`);
    return (await res.json()) as Summary;
  },
};

// Typed client for the recreated backend. Base URL is proxied in dev.
const BASE = import.meta.env.VITE_API_URL ?? "";

const TOKEN_KEY = "ll_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface User {
  id: number | string;
  user_name: string;
  role_id: string;
  auth_id: string;
  status: string;
  email?: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const api = {
  login: (user_name: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ user_name, password }),
    }),
  authStatus: () =>
    request<{ authenticated: boolean; role: string; user_name: string }>("/auth/status"),
  users: () => request<User[]>("/users"),
};

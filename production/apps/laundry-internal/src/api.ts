export interface MonthlyOperations {
  period: string;
  delivered: number;
  outstanding: number;
  billable: number;
  received: number;
}

export interface Bill {
  bill_id: string;
  organization_id?: string;
  order_id?: string;
  status?: string;
  amount?: number;
  period?: string;
  updated_at?: string;
  edit_reason?: string;
  edited_by?: string;
}

export interface Invoice {
  invoice_id: string;
  bill_id?: string;
  status?: string;
  total?: number;
  period?: string;
  edit_reason?: string;
  edited_by?: string;
}

export interface BillRecord extends Bill {
  bill_id: string;
  amount: number;
}

export interface InvoiceRecord extends Invoice {
  invoice_id: string;
  total: number;
}

export interface BillEditResult {
  bill: Bill;
  monthly_operations: MonthlyOperations;
}

export interface InvoiceEditResult {
  invoice: Invoice;
  monthly_operations: MonthlyOperations;
}

export interface Adjustment {
  id: string;
  gate_pass_id: string;
  item_name: string;
  specification: string;
  original_qty: number;
  corrected_qty: number;
  reason: string;
  status: string;
  requested_by: string;
  created_at: string;
  updated_at?: string;
}

export interface AdjustmentDecision {
  id: string;
  status: string;
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

export function fetchMonthlyOperations(period: string): Promise<MonthlyOperations> {
  return request<MonthlyOperations>(`/operations/monthly?period=${encodeURIComponent(period)}`);
}

export function fetchBills(period: string): Promise<BillRecord[]> {
  return request<BillRecord[]>(`/bills?period=${encodeURIComponent(period)}`);
}

export function fetchInvoices(period: string): Promise<InvoiceRecord[]> {
  return request<InvoiceRecord[]>(`/invoices?period=${encodeURIComponent(period)}`);
}

export function editBill(
  billId: string,
  amount: number,
  reason: string,
  actorId: string,
): Promise<BillEditResult> {
  return request<BillEditResult>(`/bills/${encodeURIComponent(billId)}/edit`, {
    method: "POST",
    body: JSON.stringify({ amount, reason, actor_id: actorId }),
  });
}

export function editInvoice(
  invoiceId: string,
  total: number,
  reason: string,
  actorId: string,
): Promise<InvoiceEditResult> {
  return request<InvoiceEditResult>(`/invoices/${encodeURIComponent(invoiceId)}/edit`, {
    method: "POST",
    body: JSON.stringify({ total, reason, actor_id: actorId }),
  });
}

export function fetchAdjustments(status?: string): Promise<Adjustment[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<Adjustment[]>(`/adjustments${qs}`);
}

export function approveAdjustment(
  adjustmentId: string,
  approver: { auth_id: string; user_name: string },
): Promise<AdjustmentDecision> {
  return request<AdjustmentDecision>(`/adjustments/${encodeURIComponent(adjustmentId)}/approve`, {
    method: "POST",
    body: JSON.stringify(approver),
  });
}

export function rejectAdjustment(
  adjustmentId: string,
  actor: { auth_id: string; user_name: string },
): Promise<AdjustmentDecision> {
  return request<AdjustmentDecision>(`/adjustments/${encodeURIComponent(adjustmentId)}/reject`, {
    method: "POST",
    body: JSON.stringify(actor),
  });
}

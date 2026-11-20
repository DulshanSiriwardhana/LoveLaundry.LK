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

export interface BillEditResult {
  bill: Bill;
  monthly_operations: MonthlyOperations;
}

export interface InvoiceEditResult {
  invoice: Invoice;
  monthly_operations: MonthlyOperations;
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

export function fetchMonthlyOperations(period: string): Promise<MonthlyOperations> {
  return request<MonthlyOperations>(`/operations/monthly?period=${encodeURIComponent(period)}`);
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

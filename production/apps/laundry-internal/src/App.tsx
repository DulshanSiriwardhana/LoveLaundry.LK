import { useCallback, useEffect, useState } from "react";
import {
  approveAdjustment,
  editBill,
  editInvoice,
  fetchAdjustments,
  fetchBills,
  fetchInvoices,
  fetchMonthlyOperations,
  rejectAdjustment,
  type Adjustment,
  type BillRecord,
  type InvoiceRecord,
  type MonthlyOperations,
} from "./api";
import { actorId, getSession, logout, type SessionUser } from "./auth";
import { LoginScreen } from "./LoginScreen";
import { ThemeSwitcher } from "./ll-theme";

const CURRENT_PERIOD = new Date().toISOString().slice(0, 7);

type EditTarget =
  | { kind: "bill"; id: BillRecord["bill_id"]; value: BillRecord["amount"] }
  | { kind: "invoice"; id: InvoiceRecord["invoice_id"]; value: InvoiceRecord["total"] };

interface BillingRow {
  key: string;
  label: string;
  detail: string;
  target: EditTarget;
}

export function App() {
  const [session, setSession] = useState<SessionUser | null>(() => getSession());
  // The API layer signals a confirmed session expiry; clear the in-memory
  // session so the login screen renders without a full page reload.
  useEffect(() => {
    const onExpired = () => setSession(null);
    window.addEventListener("ll:session-expired", onExpired);
    return () => window.removeEventListener("ll:session-expired", onExpired);
  }, []);

  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const [operations, setOperations] = useState<MonthlyOperations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMonthlyOperations(period);
      setOperations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load monthly operations");
    } finally {
      setLoading(false);
    }
  }, [period]);

  const loadAdjustments = useCallback(async () => {
    setAdjLoading(true);
    setAdjError(null);
    try {
      const data = await fetchAdjustments("REQUESTED");
      setAdjustments(data);
    } catch (err) {
      setAdjError(err instanceof Error ? err.message : "Failed to load adjustments");
    } finally {
      setAdjLoading(false);
    }
  }, []);

  const loadBillingRows = useCallback(async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const [billRows, invoiceRows] = await Promise.all([fetchBills(period), fetchInvoices(period)]);
      setBills(billRows);
      setInvoices(invoiceRows);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Failed to load bills and invoices");
    } finally {
      setBillingLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (!session) {
      return;
    }
    void load();
    void loadAdjustments();
    void loadBillingRows();
  }, [load, loadAdjustments, loadBillingRows, session]);

  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** Re-run the API calls that feed the current screen. */
  const refreshPage = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([load(), loadAdjustments(), loadBillingRows()]);
      setLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setRefreshing(false);
    }
  };

  const signOut = () => {
    logout();
    setSession(null);
  };

  const openEditor = (target: EditTarget) => {
    setEdit(target);
    setReason("");
    setError(null);
    setNotice(null);
  };

  const saveEdit = async () => {
    if (!edit) {
      return;
    }
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError("A reason is required to edit.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const actorIdValue = actorId();
      const result =
        edit.kind === "bill"
          ? await editBill(edit.id, edit.value, cleanReason, actorIdValue)
          : await editInvoice(edit.id, edit.value, cleanReason, actorIdValue);
      setOperations(result.monthly_operations);
      setNotice(`Updated ${edit.kind} ${edit.id}. Monthly operations refreshed.`);
      setEdit(null);
      setReason("");
      await loadBillingRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return <LoginScreen onAuthenticated={setSession} />;
  }

  const decide = async (adjustment: Adjustment, approve: boolean) => {
    const actor = { auth_id: actorId(), user_name: session.user_name };
    const decision = approve
      ? await approveAdjustment(adjustment.id, actor)
      : await rejectAdjustment(adjustment.id, actor);
    setNotice(`Adjustment ${adjustment.id} ${decision.status}.`);
    await loadAdjustments();
  };

  const tiles = operations
    ? [
        { label: "Delivered", value: operations.delivered },
        { label: "Outstanding", value: operations.outstanding },
        { label: "Billable", value: operations.billable },
        { label: "Received", value: operations.received },
      ]
    : [];

  const billingRows: BillingRow[] = [
    ...bills.map((bill) => ({
      key: `bill-${bill.bill_id}`,
      label: `Bill ${bill.bill_id}`,
      detail: `${bill.status ?? "unknown"} · ${(bill.amount ?? 0).toFixed(2)}${bill.edited_by ? ` · edited by ${bill.edited_by}` : ""}`,
      target: { kind: "bill" as const, id: bill.bill_id, value: bill.amount ?? 0 },
    })),
    ...invoices.map((invoice) => ({
      key: `invoice-${invoice.invoice_id}`,
      label: `Invoice ${invoice.invoice_id}`,
      detail: `${invoice.status ?? "unknown"} · ${(invoice.total ?? 0).toFixed(2)}${invoice.edited_by ? ` · edited by ${invoice.edited_by}` : ""}`,
      target: { kind: "invoice" as const, id: invoice.invoice_id, value: invoice.total ?? 0 },
    })),
  ];

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Love Laundry · production</p>
          <h1>Monthly Operations</h1>
          <p className="muted">Billing and adjustment control for the current period.</p>
        </div>
        <div className="session">
          <ThemeSwitcher compact />
          <span className="badge badge--soft">{session.user_name}</span>
          {lastUpdated ? <span className="muted">{`Updated ${lastUpdated}`}</span> : null}
          <button type="button" className="btn btn--ghost" onClick={() => void refreshPage()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        <section className="hero-band">
          <div className="hero-band__grid" aria-hidden="true" />
          <div className="hero-band__content">
            <span className="hero-band__icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 4 7v6c0 4.5 3.2 7.4 8 8 4.8-.6 8-3.5 8-8V7l-8-4Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <div>
              <p className="eyebrow eyebrow--light">Finance control</p>
              <h1>Period {period}</h1>
              <p>Review deliveries, correct billing and clear pending adjustments.</p>
            </div>
          </div>
        </section>

        <header className="page-header">
          <div>
            <p className="page-header__eyebrow">Laundry internal</p>
            <h2 className="page-header__title">Monthly Operations</h2>
            <p className="page-header__subtitle">
              Period totals come from the production API. Corrections require a reason and are
              written back through the audited service endpoints.
            </p>
          </div>
          <div className="page-header__actions">
            <span className="badge badge--brand">Staff workspace</span>
          </div>
        </header>

        <label className="field">
          <span>Reporting period</span>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </label>

        {loading ? <p className="muted">Loading operations…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}

        <section className="stat-grid">
          {tiles.map((tile) => (
            <article key={tile.label} className="stat-card">
              <p className="stat-card__label">{tile.label}</p>
              <p className="stat-card__value">{tile.value.toFixed(2)}</p>
              <p className="list__meta">Current period</p>
            </article>
          ))}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Approvals</p>
              <h2>Adjustments awaiting approval</h2>
            </div>
            <span className="badge badge--brand">{adjustments.length} pending</span>
          </div>
          {adjLoading ? <p className="muted">Loading adjustments…</p> : null}
          {adjError ? <p role="alert">{adjError}</p> : null}
          {adjustments.length === 0 && !adjLoading ? <p className="empty">No adjustments awaiting approval.</p> : null}
          <ul className="list">
            {adjustments.map((a) => (
              <li key={a.id}>
                <strong>{a.item_name}</strong>
                {a.specification ? ` (${a.specification})` : ""} — {a.original_qty} → {a.corrected_qty}
                <p className="list__meta">reason: {a.reason}</p>
                <div className="actions">
                  <button type="button" onClick={() => void decide(a, true)}>Approve</button>
                  <button type="button" onClick={() => void decide(a, false)}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Billing</p>
              <h2>Bills &amp; invoices</h2>
            </div>
            <span className="badge badge--soft">{billingRows.length} records</span>
          </div>
          {billingLoading ? <p className="muted">Loading bills and invoices…</p> : null}
          {billingError ? <p role="alert">{billingError}</p> : null}
          {billingRows.length === 0 && !billingLoading ? <p className="empty">No bills or invoices recorded for this period.</p> : null}
          <ul className="list">
            {billingRows.map((row) => (
              <li key={row.key}>
                <div className="section-heading">
                  <span>
                    <strong>{row.label}</strong>
                    <span className="list__meta"> · {row.detail}</span>
                  </span>
                  <button type="button" onClick={() => openEditor(row.target)}>Edit</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {edit ? (
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Correction</p>
                <h2>Edit {edit.kind}</h2>
              </div>
              <code className="code-chip">{edit.id}</code>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Amount</span>
                <input
                  type="number"
                  step="0.01"
                  value={edit.value}
                  onChange={(e) => setEdit({ ...edit, value: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>Reason</span>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>
            <div className="actions">
              <button type="button" onClick={() => void saveEdit()} disabled={saving}>
                {saving ? "Saving…" : "Save edit"}
              </button>
              <button type="button" className="btn--ghost" onClick={() => { setEdit(null); setReason(""); }}>
                Cancel
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

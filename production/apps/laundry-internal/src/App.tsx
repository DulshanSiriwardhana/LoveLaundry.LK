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
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>Monthly Operations</h1>
          <p style={{ margin: "0.35rem 0" }}>LoveLaundry production rebuild surface.</p>
          <p style={{ margin: 0 }}>Signed in as {session.user_name}</p>
        </div>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </header>

      <label style={{ display: "block", margin: "1rem 0" }}>
        Period
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{ display: "block", marginTop: "0.5rem" }}
        />
      </label>

      {loading ? <p>Loading…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p>{notice}</p> : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>
        {tiles.map((tile) => (
          <div key={tile.label} style={{ border: "1px solid #d1d5db", borderRadius: "0.5rem", padding: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>{tile.label}</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "1.25rem", fontWeight: 600 }}>{tile.value.toFixed(2)}</p>
          </div>
        ))}
      </section>

      <section style={{ marginTop: "1.5rem", border: "1px solid #d1d5db", borderRadius: "0.5rem", padding: "1rem" }}>
        <h2>Adjustments awaiting approval</h2>
        {adjLoading ? <p>Loading adjustments…</p> : null}
        {adjError ? <p role="alert">{adjError}</p> : null}
        {adjustments.length === 0 && !adjLoading ? <p>No adjustments awaiting approval.</p> : null}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {adjustments.map((a) => (
            <li key={a.id} style={{ borderBottom: "1px solid #e5e7eb", padding: "0.5rem 0" }}>
              <strong>{a.item_name}</strong>
              {a.specification ? ` (${a.specification})` : ""} — {a.original_qty} → {a.corrected_qty}
              <span style={{ marginLeft: "0.5rem" }}>reason: {a.reason}</span>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
                <button type="button" onClick={() => void decide(a, true)}>Approve</button>
                <button type="button" onClick={() => void decide(a, false)}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: "1.5rem", border: "1px solid #d1d5db", borderRadius: "0.5rem", padding: "1rem" }}>
        <h2>Bills &amp; invoices</h2>
        {billingLoading ? <p>Loading bills and invoices…</p> : null}
        {billingError ? <p role="alert">{billingError}</p> : null}
        {billingRows.length === 0 && !billingLoading ? <p>No bills or invoices recorded for this period.</p> : null}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {billingRows.map((row) => (
            <li key={row.key} style={{ borderBottom: "1px solid #e5e7eb", padding: "0.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
              <button type="button" onClick={() => openEditor(row.target)} style={{ marginLeft: "auto" }}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      </section>

      {edit ? (
        <section style={{ marginTop: "1.5rem", border: "1px solid #d1d5db", borderRadius: "0.5rem", padding: "1rem" }}>
          <h2>Edit {edit.kind}</h2>
          <p>{edit.id}</p>
          <label style={{ display: "block" }}>
            Amount
            <input
              type="number"
              step="0.01"
              value={edit.value}
              onChange={(e) => setEdit({ ...edit, value: Number(e.target.value) })}
              style={{ display: "block", marginTop: "0.25rem" }}
            />
          </label>
          <label style={{ display: "block", marginTop: "0.75rem" }}>
            Reason
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ display: "block", marginTop: "0.25rem", width: "100%" }}
            />
          </label>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" onClick={() => void saveEdit()} disabled={saving}>
              {saving ? "Saving…" : "Save edit"}
            </button>
            <button type="button" onClick={() => { setEdit(null); setReason(""); }}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

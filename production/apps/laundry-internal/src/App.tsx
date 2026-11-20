import { useCallback, useEffect, useState } from "react";
import {
  approveAdjustment,
  editBill,
  editInvoice,
  fetchAdjustments,
  fetchMonthlyOperations,
  rejectAdjustment,
  type Adjustment,
  type MonthlyOperations,
} from "./api";

const CURRENT_PERIOD = new Date().toISOString().slice(0, 7);

export function App() {
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const [operations, setOperations] = useState<MonthlyOperations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ kind: "bill" | "invoice"; id: string; value: number } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);

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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAdjustments();
  }, [loadAdjustments]);

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
      const result =
        edit.kind === "bill"
          ? await editBill(edit.id, edit.value, cleanReason, "production-app")
          : await editInvoice(edit.id, edit.value, cleanReason, "production-app");
      setOperations(result.monthly_operations);
      setNotice(`Updated ${edit.kind} ${edit.id}. Monthly operations refreshed.`);
      setEdit(null);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const decide = async (adjustment: Adjustment, approve: boolean) => {
    const actor = approve ? { auth_id: "approver-1", user_name: "approver-1" } : { auth_id: "approver-2", user_name: "approver-2" };
    const decision = approve ? await approveAdjustment(adjustment.id, actor) : await rejectAdjustment(adjustment.id, actor);
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

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Monthly Operations</h1>
      <p>LoveLaundry production rebuild surface.</p>

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

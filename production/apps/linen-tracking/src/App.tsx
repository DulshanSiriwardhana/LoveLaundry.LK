import { useCallback, useEffect, useState } from "react";
import { fetchLinenOperations, recordLinenMovement, type LinenOperations } from "./api";

const CURRENT_PERIOD = new Date().toISOString().slice(0, 7);

export function App() {
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const [operations, setOperations] = useState<LinenOperations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [movement, setMovement] = useState({
    movement_id: "",
    linen_id: "",
    direction: "in" as "in" | "out",
    quantity: 1,
    from_org: "",
    to_org: "",
    period: CURRENT_PERIOD,
    reason: "",
    actor_id: "production-app",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLinenOperations(period);
      setOperations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load linen operations");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveMovement = async () => {
    const cleanReason = movement.reason.trim();
    if (!cleanReason) {
      setError("A reason is required to record a movement.");
      return;
    }
    if (!movement.movement_id.trim() || !movement.linen_id.trim()) {
      setError("Movement and linen identifiers are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await recordLinenMovement({ ...movement, reason: cleanReason, movement_id: movement.movement_id.trim(), linen_id: movement.linen_id.trim() });
      setNotice(`Movement ${movement.movement_id} recorded.`);
      setMovement({ ...movement, reason: "", quantity: movement.quantity });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record movement.");
    } finally {
      setSaving(false);
    }
  };

  const tiles = operations
    ? [
        { label: "Received", value: operations.received },
        { label: "Delivered", value: operations.delivered },
        { label: "Net", value: operations.net },
      ]
    : [];

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Linen Tracking</h1>
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
        <h2>Record movement</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
          <label style={{ display: "block" }}>
            Movement ID
            <input type="text" value={movement.movement_id} onChange={(e) => setMovement({ ...movement, movement_id: e.target.value })} style={{ display: "block", marginTop: "0.25rem" }} />
          </label>
          <label style={{ display: "block" }}>
            Linen ID
            <input type="text" value={movement.linen_id} onChange={(e) => setMovement({ ...movement, linen_id: e.target.value })} style={{ display: "block", marginTop: "0.25rem" }} />
          </label>
          <label style={{ display: "block" }}>
            Direction
            <select value={movement.direction} onChange={(e) => setMovement({ ...movement, direction: e.target.value as "in" | "out" })} style={{ display: "block", marginTop: "0.25rem" }}>
              <option value="in">In</option>
              <option value="out">Out</option>
            </select>
          </label>
          <label style={{ display: "block" }}>
            Quantity
            <input type="number" step="0.01" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: Number(e.target.value) })} style={{ display: "block", marginTop: "0.25rem" }} />
          </label>
          <label style={{ display: "block" }}>
            From org
            <input type="text" value={movement.from_org} onChange={(e) => setMovement({ ...movement, from_org: e.target.value })} style={{ display: "block", marginTop: "0.25rem" }} />
          </label>
          <label style={{ display: "block" }}>
            To org
            <input type="text" value={movement.to_org} onChange={(e) => setMovement({ ...movement, to_org: e.target.value })} style={{ display: "block", marginTop: "0.25rem" }} />
          </label>
          <label style={{ display: "block" }}>
            Period
            <input type="month" value={movement.period} onChange={(e) => setMovement({ ...movement, period: e.target.value })} style={{ display: "block", marginTop: "0.25rem" }} />
          </label>
          <label style={{ display: "block" }}>
            Reason
            <input type="text" value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })} style={{ display: "block", marginTop: "0.25rem" }} />
          </label>
        </div>
        <button type="button" onClick={() => void saveMovement()} disabled={saving} style={{ marginTop: "1rem" }}>
          {saving ? "Saving…" : "Record movement"}
        </button>
      </section>
    </main>
  );
}

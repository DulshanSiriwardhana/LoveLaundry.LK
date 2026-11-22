import { useCallback, useEffect, useState } from "react";
import { fetchLinenOperations, recordLinenMovement, type LinenOperations } from "./api";
import { actorId, getSession, logout, type SessionUser } from "./auth";
import { LoginScreen } from "./LoginScreen";
import { ThemeSwitcher } from "./ll-theme";

const CURRENT_PERIOD = new Date().toISOString().slice(0, 7);

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
    if (!session) {
      return;
    }
    void load();
  }, [load, session]);

  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** Re-run the API calls that feed the current screen. */
  const refreshPage = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([load()]);
      setLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setRefreshing(false);
    }
  };

  const signOut = () => {
    logout();
    setSession(null);
  };

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
      await recordLinenMovement({ ...movement, actor_id: actorId(), reason: cleanReason, movement_id: movement.movement_id.trim(), linen_id: movement.linen_id.trim() });
      setNotice(`Movement ${movement.movement_id} recorded.`);
      setMovement({ ...movement, reason: "", quantity: movement.quantity });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record movement.");
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return <LoginScreen onAuthenticated={setSession} />;
  }

  const tiles = operations
    ? [
        { label: "Received", value: operations.received },
        { label: "Delivered", value: operations.delivered },
        { label: "Net", value: operations.net },
      ]
    : [];

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Love Laundry · linen</p>
          <h1>Linen Tracking</h1>
          <p className="muted">Piece-level movement and counts for the current period.</p>
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
              <p className="eyebrow eyebrow--light">Inventory control</p>
              <h1>Period {period}</h1>
              <p>Record every movement with a reason so the count stays honest.</p>
            </div>
          </div>
        </section>

        <header className="page-header">
          <div>
            <p className="page-header__eyebrow">Linen room</p>
            <h2 className="page-header__title">Linen Tracking</h2>
            <p className="page-header__subtitle">
              Counts are read from the production linen service. Movements are written back
              through the audited endpoint with the acting operator attached.
            </p>
          </div>
          <div className="page-header__actions">
            <span className="badge badge--brand">Scan workspace</span>
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
              <p className="eyebrow">Movement</p>
              <h2>Record movement</h2>
            </div>
            <span className="badge badge--soft">Audited</span>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Movement ID</span>
              <input type="text" value={movement.movement_id} onChange={(e) => setMovement({ ...movement, movement_id: e.target.value })} />
            </label>
            <label className="field">
              <span>Linen ID</span>
              <input type="text" value={movement.linen_id} onChange={(e) => setMovement({ ...movement, linen_id: e.target.value })} />
            </label>
            <label className="field">
              <span>Direction</span>
              <select value={movement.direction} onChange={(e) => setMovement({ ...movement, direction: e.target.value as "in" | "out" })}>
                <option value="in">In</option>
                <option value="out">Out</option>
              </select>
            </label>
            <label className="field">
              <span>Quantity</span>
              <input type="number" step="0.01" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span>From org</span>
              <input type="text" value={movement.from_org} onChange={(e) => setMovement({ ...movement, from_org: e.target.value })} />
            </label>
            <label className="field">
              <span>To org</span>
              <input type="text" value={movement.to_org} onChange={(e) => setMovement({ ...movement, to_org: e.target.value })} />
            </label>
            <label className="field">
              <span>Period</span>
              <input type="month" value={movement.period} onChange={(e) => setMovement({ ...movement, period: e.target.value })} />
            </label>
            <label className="field">
              <span>Reason</span>
              <input type="text" value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })} />
            </label>
          </div>
          <div className="actions">
            <button type="button" onClick={() => void saveMovement()} disabled={saving}>
              {saving ? "Saving…" : "Record movement"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

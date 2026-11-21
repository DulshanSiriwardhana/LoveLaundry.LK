import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  captureReaderReads,
  fetchHotelDashboard,
  fetchLinenOperations,
  fetchMissingAlerts,
  getScanSession,
  listLinenProfiles,
  listScanSessions,
  newScanId,
  reconcileScanSession,
  recordLinenMovement,
  resolveMissingAlert,
  submitReaderReads,
  submitScan,
  type LinenOperations,
  type MissingAlertRow,
  type ScanMethod,
  type ScanResult,
} from "./api";
import { actorId, getSession, logout, type SessionUser } from "./auth";
import { LoginScreen } from "./LoginScreen";

type Route = "operations" | "scan" | "bulk" | "exceptions" | "dashboard";

const ROUTES: Route[] = ["operations", "scan", "bulk", "exceptions", "dashboard"];

const LABELS: Record<Route, string> = {
  operations: "Operations",
  scan: "QR / RFID scan",
  bulk: "RFID bulk session",
  exceptions: "Missing & damaged",
  dashboard: "Dashboard",
};

const SCAN_ACTIONS = [
  "assign",
  "make_available",
  "collect",
  "dispatch_from_client",
  "receive_at_client",
  "return_to_circulation",
  "report_missing",
  "report_damaged",
  "flag_overdue",
  "investigate",
];

const CURRENT_PERIOD = new Date().toISOString().slice(0, 7);

function organizationFor(session: SessionUser | null): string {
  if (!session) {
    return "";
  }
  return (
    session.hotel_id ||
    session.shop_id ||
    session.organization_id ||
    session.laundry_id ||
    ""
  );
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function Tiles({ value }: { value: Record<string, unknown> }) {
  return (
    <section className="tiles">
      {Object.entries(value)
        .filter(([, item]) => item !== null && typeof item !== "object")
        .map(([label, item]) => (
          <article key={label}>
            <p>{label}</p>
            <strong>{renderValue(item)}</strong>
          </article>
        ))}
    </section>
  );
}

function Rows({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = Array.from(
    new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row))),
  );
  if (columns.length === 0) {
    return <p className="empty">No records returned.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(
                row.alert_id ?? row.linen_id ?? row.session_id ?? index,
              )}
            >
              {columns.map((column) => (
                <td key={column}>{renderValue(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<SessionUser | null>(() => getSession());
  const [route, setRoute] = useState<Route>("operations");
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const [operations, setOperations] = useState<LinenOperations | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [alerts, setAlerts] = useState<MissingAlertRow[]>([]);
  const [profiles, setProfiles] = useState<Array<Record<string, unknown>>>([]);
  const [bulkResult, setBulkResult] = useState<Record<string, unknown> | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [movement, setMovement] = useState({
    movement_id: "",
    linen_id: "",
    direction: "out" as "in" | "out",
    quantity: 1,
    from_org: "hotel",
    to_org: "laundry",
    period: CURRENT_PERIOD,
    reason: "",
  });
  const [scanDraft, setScanDraft] = useState({
    method: "qr" as ScanMethod,
    identifier: "",
    action: "dispatch_from_client",
  });
  const [bulkDraft, setBulkDraft] = useState({
    session_id: "",
    reader_id: "",
    reader_key: "",
    epcs: "",
  });
  const [exceptionDraft, setExceptionDraft] = useState({
    linen_id: "",
    action: "report_missing",
  });

  const load = useCallback(async () => {
    if (!session) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const organizationId = organizationFor(session);
      if (route === "operations") {
        setOperations(await fetchLinenOperations(period));
      } else if (route === "dashboard") {
        setData(await fetchHotelDashboard(organizationId));
      } else if (route === "exceptions") {
        const [alertRows, profileRows] = await Promise.all([
          fetchMissingAlerts(organizationId),
          listLinenProfiles(organizationId),
        ]);
        setAlerts(alertRows);
        setProfiles(profileRows as unknown as Array<Record<string, unknown>>);
      } else if (route === "bulk") {
        setData(await listScanSessions());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scanner data");
    } finally {
      setLoading(false);
    }
  }, [period, route, session]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!movement.movement_id.trim() || !movement.linen_id.trim()) {
      setError("Movement and linen identifiers are required.");
      return;
    }
    if (!movement.reason.trim()) {
      setError("A reason is required to record a movement.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await recordLinenMovement({
        ...movement,
        actor_id: actorId(),
        reason: movement.reason.trim(),
        movement_id: movement.movement_id.trim(),
        linen_id: movement.linen_id.trim(),
      });
      setNotice(`Dispatch movement ${movement.movement_id} recorded.`);
      setMovement({ ...movement, reason: "", movement_id: "", linen_id: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record movement.");
    } finally {
      setSaving(false);
    }
  };

  const submitItemScan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const identifier = scanDraft.identifier.trim();
    if (!identifier) {
      setError("Scan or enter a QR identifier, linen ID, or RFID EPC.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await submitScan({
        scan_id: newScanId("HOTEL"),
        identifier,
        method: scanDraft.method,
        action: scanDraft.action,
        organization_id: organizationFor(session),
        scanner_id: actorId(),
      });
      setScanResult(result);
      setNotice(
        result.duplicate
          ? "Duplicate scan ignored; no new lifecycle event was created."
          : `Scan accepted with result: ${result.result}.`,
      );
      setScanDraft({ ...scanDraft, identifier: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit scan");
    } finally {
      setSaving(false);
    }
  };

  const submitBulkReads = async () => {
    const epcs = bulkDraft.epcs
      .split(/[\n,;\s]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!bulkDraft.session_id.trim() || epcs.length === 0) {
      setError("A session ID and at least one RFID EPC are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      setBulkResult(
        await submitReaderReads(
          bulkDraft.session_id.trim(),
          epcs.map((epc) => ({ epc, read_count: 1 })),
          bulkDraft.reader_id.trim(),
          bulkDraft.reader_key,
        ),
      );
      setNotice(`${epcs.length} reader observations submitted for reconciliation.`);
      setBulkDraft({ ...bulkDraft, epcs: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit reader reads");
    } finally {
      setSaving(false);
    }
  };

  const captureBulk = async () => {
    if (!bulkDraft.session_id.trim()) {
      setError("A session ID is required before capturing from a reader.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      setBulkResult(
        await captureReaderReads(
          bulkDraft.session_id.trim(),
          bulkDraft.reader_id.trim(),
          bulkDraft.reader_key,
          2,
        ),
      );
      setNotice("Reader capture completed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reader capture failed");
    } finally {
      setSaving(false);
    }
  };

  const showSession = async () => {
    if (!bulkDraft.session_id.trim()) {
      setError("Enter a session ID to inspect.");
      return;
    }
    setError(null);
    try {
      setBulkResult(
        await getScanSession(bulkDraft.session_id.trim()) as unknown as Record<
          string,
          unknown
        >,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Session lookup failed");
    }
  };

  const reconcileSession = async (sessionId: string) => {
    setError(null);
    try {
      setBulkResult(await reconcileScanSession(sessionId));
      setNotice(`${sessionId} reconciled against expected linen IDs.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconciliation failed");
    }
  };

  const reportException = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const identifier = exceptionDraft.linen_id.trim();
    if (!identifier) {
      setError("Select or enter the linen item involved in the exception.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await submitScan({
        scan_id: newScanId("EXC"),
        identifier,
        method: "qr",
        action: exceptionDraft.action,
        organization_id: organizationFor(session),
        scanner_id: actorId(),
      });
      setNotice(`Exception recorded: ${result.result}.`);
      setExceptionDraft({ ...exceptionDraft, linen_id: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record exception");
    } finally {
      setSaving(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    setError(null);
    setNotice(null);
    try {
      await resolveMissingAlert(alertId);
      setNotice(`${alertId} resolved.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve alert");
    }
  };

  if (!session) {
    return <LoginScreen onAuthenticated={setSession} />;
  }

  const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
  const dashboard = route === "dashboard" && data && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">LoveLaundry production</p>
          <h1>Hotel Scanner</h1>
          <p className="muted">
            {organizationFor(session) || "No organization on session"} · {session.user_name}
          </p>
        </div>
        <div className="session">
          <span>{lastUpdated ? `Updated ${lastUpdated}` : ""}</span>
          <button type="button" onClick={() => void refreshPage()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="routes" aria-label="Hotel scanner">
        {ROUTES.map((item) => (
          <button
            key={item}
            type="button"
            className={item === route ? "active" : ""}
            aria-current={item === route ? "page" : undefined}
            onClick={() => setRoute(item)}
          >
            {LABELS[item]}
          </button>
        ))}
      </nav>

      <section className="content">
        {loading ? <p className="muted">Loading…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}

        {route === "operations" ? (
          <>
            <label className="field">
              Period
              <input
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              />
            </label>
            {operations ? (
              <Tiles value={operations as unknown as Record<string, unknown>} />
            ) : null}
            <form
              className="editor"
              onSubmit={(event) => {
                event.preventDefault();
                void saveMovement();
              }}
            >
              <h2>Dispatch capture</h2>
              <label className="field">
                Movement ID
                <input
                  value={movement.movement_id}
                  onChange={(event) =>
                    setMovement({ ...movement, movement_id: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Linen ID
                <input
                  value={movement.linen_id}
                  onChange={(event) =>
                    setMovement({ ...movement, linen_id: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Quantity
                <input
                  type="number"
                  step="0.01"
                  value={movement.quantity}
                  onChange={(event) =>
                    setMovement({ ...movement, quantity: Number(event.target.value) })
                  }
                />
              </label>
              <label className="field">
                Reason
                <input
                  value={movement.reason}
                  onChange={(event) =>
                    setMovement({ ...movement, reason: event.target.value })
                  }
                />
              </label>
              <button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Capture dispatch"}
              </button>
            </form>
          </>
        ) : null}

        {route === "scan" ? (
          <>
            <form className="editor" onSubmit={(event) => void submitItemScan(event)}>
              <h2>Scan a linen item</h2>
              <label className="field">
                Identifier source
                <select
                  value={scanDraft.method}
                  onChange={(event) =>
                    setScanDraft({
                      ...scanDraft,
                      method: event.target.value as ScanMethod,
                    })
                  }
                >
                  <option value="qr">QR / linen ID</option>
                  <option value="epc">EPC</option>
                  <option value="rfid">RFID</option>
                </select>
              </label>
              <label className="field">
                Identifier
                <input
                  value={scanDraft.identifier}
                  onChange={(event) =>
                    setScanDraft({ ...scanDraft, identifier: event.target.value })
                  }
                  placeholder="Paste a QR URL, linen ID, or RFID EPC"
                />
              </label>
              <label className="field">
                Lifecycle action
                <select
                  value={scanDraft.action}
                  onChange={(event) =>
                    setScanDraft({ ...scanDraft, action: event.target.value })
                  }
                >
                  {SCAN_ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={saving}>
                {saving ? "Submitting…" : "Submit scan"}
              </button>
            </form>
            {scanResult ? <pre className="result">{JSON.stringify(scanResult, null, 2)}</pre> : null}
          </>
        ) : null}

        {route === "bulk" ? (
          <>
            <form
              className="editor"
              onSubmit={(event) => {
                event.preventDefault();
                void submitBulkReads();
              }}
            >
              <h2>Bulk RFID submission</h2>
              <p className="muted">
                Start the session from the laundry workflow. Reader credentials are
                sent only to the reader-authenticated endpoints and are never stored.
              </p>
              <label className="field">
                Active session ID
                <input
                  value={bulkDraft.session_id}
                  onChange={(event) =>
                    setBulkDraft({ ...bulkDraft, session_id: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Reader ID
                <input
                  value={bulkDraft.reader_id}
                  onChange={(event) =>
                    setBulkDraft({ ...bulkDraft, reader_id: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Reader key
                <input
                  type="password"
                  value={bulkDraft.reader_key}
                  onChange={(event) =>
                    setBulkDraft({ ...bulkDraft, reader_key: event.target.value })
                  }
                />
              </label>
              <label className="field">
                EPCs (one per line)
                <textarea
                  value={bulkDraft.epcs}
                  onChange={(event) =>
                    setBulkDraft({ ...bulkDraft, epcs: event.target.value })
                  }
                />
              </label>
              <div className="actions">
                <button type="submit" disabled={saving}>
                  Submit EPCs
                </button>
                <button type="button" onClick={() => void captureBulk()} disabled={saving}>
                  Capture from reader
                </button>
                <button type="button" onClick={() => void showSession()}>
                  Inspect session
                </button>
              </div>
            </form>
            {bulkResult ? (
              <pre className="result">{JSON.stringify(bulkResult, null, 2)}</pre>
            ) : null}
            <Rows rows={rows} />
            {rows.map((row) => (
              <button
                key={String(row.session_id ?? "")}
                type="button"
                onClick={() => void reconcileSession(String(row.session_id ?? ""))}
              >
                Reconcile {String(row.session_id ?? "")}
              </button>
            ))}
          </>
        ) : null}

        {route === "exceptions" ? (
          <>
            <form
              className="editor"
              onSubmit={(event) => void reportException(event)}
            >
              <h2>Report a missing or damaged item</h2>
              <label className="field">
                Linen ID
                <input
                  list="hotel-linen-options"
                  value={exceptionDraft.linen_id}
                  onChange={(event) =>
                    setExceptionDraft({ ...exceptionDraft, linen_id: event.target.value })
                  }
                />
                <datalist id="hotel-linen-options">
                  {profiles.map((row) => (
                    <option key={String(row.linen_id)} value={String(row.linen_id)} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                Exception
                <select
                  value={exceptionDraft.action}
                  onChange={(event) =>
                    setExceptionDraft({ ...exceptionDraft, action: event.target.value })
                  }
                >
                  <option value="report_missing">report_missing</option>
                  <option value="report_damaged">report_damaged</option>
                  <option value="flag_overdue">flag_overdue</option>
                  <option value="investigate">investigate</option>
                </select>
              </label>
              <button type="submit" disabled={saving}>
                Record exception
              </button>
            </form>
            <Rows rows={alerts as unknown as Array<Record<string, unknown>>} />
            {alerts
              .filter((row) => row.status === "open")
              .map((row) => (
                <button
                  key={row.alert_id}
                  type="button"
                  onClick={() => void resolveAlert(row.alert_id)}
                >
                  Resolve {row.alert_id}
                </button>
              ))}
          </>
        ) : null}

        {dashboard ? (
          <>
            <Tiles value={dashboard} />
            {"stage_breakdown" in dashboard ? (
              <pre className="result">
                {JSON.stringify(dashboard.stage_breakdown, null, 2)}
              </pre>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

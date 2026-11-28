import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  captureReaderReads,
  completeScanSession,
  fetchLaundryDashboard,
  fetchLinenOperations,
  fetchMissingAlerts,
  fetchTagAlerts,
  getScanSession,
  listLinenProfiles,
  listScanSessions,
  newScanId,
  reconcileScanSession,
  recordLinenMovement,
  resolveMissingAlert,
  startScanSession,
  submitReaderReads,
  submitScan,
  type LinenOperations,
  type MissingAlertRow,
  type ScanMethod,
  type ScanResult,
  type TagAlertRow,
} from "./api";
import { actorId, getSession, logout, type SessionUser } from "./auth";
import { LoginScreen } from "./LoginScreen";
import { ThemeSwitcher } from "./ll-theme";
import { LiveTag } from "./components/LiveTag";

type Route = "operations" | "scan" | "bulk" | "wash" | "exceptions" | "dashboard";

const ROUTES: Route[] = [
  "operations",
  "scan",
  "bulk",
  "wash",
  "exceptions",
  "dashboard",
];

const LABELS: Record<Route, string> = {
  operations: "Operations",
  scan: "QR / RFID scan",
  bulk: "RFID bulk session",
  wash: "Wash monitoring",
  exceptions: "Missing & damaged",
  dashboard: "Dashboard",
};

const SCAN_ACTIONS = [
  "receive_at_laundry",
  "sort",
  "start_washing",
  "complete_washing",
  "iron_fold",
  "inspect",
  "mark_ready",
  "dispatch_from_laundry",
  "report_damaged",
  "reject",
  "quarantine",
];

const EXCEPTION_ACTIONS = [
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
    session.laundry_id ||
    session.organization_id ||
    session.hotel_id ||
    session.shop_id ||
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
                <td key={column}>
                  {column === "linen_id" && String(row[column] ?? "").trim() ? (
                    <LiveTag linenId={String(row[column])} compact />
                  ) : (
                    renderValue(row[column])
                  )}
                </td>
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
  // The API layer signals a confirmed session expiry; clear the in-memory
  // session so the login screen renders without a full page reload.
  useEffect(() => {
    const onExpired = () => setSession(null);
    window.addEventListener("ll:session-expired", onExpired);
    return () => window.removeEventListener("ll:session-expired", onExpired);
  }, []);

  const [route, setRoute] = useState<Route>("operations");
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const [operations, setOperations] = useState<LinenOperations | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [tagAlerts, setTagAlerts] = useState<TagAlertRow[]>([]);
  const [missingAlerts, setMissingAlerts] = useState<MissingAlertRow[]>([]);
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
    direction: "in" as "in" | "out",
    quantity: 1,
    from_org: "hotel",
    to_org: "laundry",
    period: CURRENT_PERIOD,
    reason: "",
  });
  const [scanDraft, setScanDraft] = useState({
    method: "qr" as ScanMethod,
    identifier: "",
    action: "receive_at_laundry",
    workflow_reference: "",
  });
  const [bulkDraft, setBulkDraft] = useState({
    session_id: "",
    action: "receive_at_laundry",
    reader_id: "",
    reader_key: "",
    expected_ids: "",
    epcs: "",
  });
  const [exceptionDraft, setExceptionDraft] = useState({
    linen_id: "",
    action: "report_damaged",
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
        setData(await fetchLaundryDashboard(organizationId));
      } else if (route === "bulk") {
        setData(await listScanSessions());
      } else if (route === "wash") {
        const [alerts, rows] = await Promise.all([
          fetchTagAlerts(),
          listLinenProfiles(organizationId),
        ]);
        setTagAlerts(alerts);
        setProfiles(rows as unknown as Array<Record<string, unknown>>);
      } else if (route === "exceptions") {
        const [alerts, rows] = await Promise.all([
          fetchMissingAlerts(organizationId),
          listLinenProfiles(organizationId),
        ]);
        setMissingAlerts(alerts);
        setProfiles(rows as unknown as Array<Record<string, unknown>>);
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
      setNotice(`Intake movement ${movement.movement_id} recorded.`);
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
        scan_id: newScanId("LAUNDRY"),
        identifier,
        method: scanDraft.method,
        action: scanDraft.action,
        organization_id: organizationFor(session),
        scanner_id: actorId(),
        workflow_reference: scanDraft.workflow_reference.trim(),
      });
      setScanResult(result);
      setNotice(
        result.duplicate
          ? "Duplicate scan ignored; no new lifecycle event was created."
          : `Scan accepted with result: ${result.result}.`,
      );
      setScanDraft({ ...scanDraft, identifier: "", workflow_reference: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit scan");
    } finally {
      setSaving(false);
    }
  };

  const startSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const sessionId = bulkDraft.session_id.trim() || newScanId("SES");
      const expected = bulkDraft.expected_ids
        .split(/[\n,;\s]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      await startScanSession({
        session_id: sessionId,
        organization_id: organizationFor(session),
        action: bulkDraft.action,
        reader_id: bulkDraft.reader_id.trim(),
        expected_linen_ids: expected,
        expected_count: expected.length,
        mode: "bulk",
      });
      setBulkDraft({ ...bulkDraft, session_id: sessionId, expected_ids: "", epcs: "" });
      setNotice(`Session ${sessionId} is active.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start scan session");
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
      setError("An active session ID and at least one RFID EPC are required.");
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
      setError("An active session ID is required before capturing from a reader.");
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

  const finishSession = async (sessionId: string) => {
    setError(null);
    setNotice(null);
    try {
      setBulkResult(await completeScanSession(sessionId));
      setNotice(`${sessionId} completed and reconciled.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete session");
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
          <h1>Laundry Scanner</h1>
          <p className="muted">
            {organizationFor(session) || "No organization on session"} · {session.user_name}
          </p>
        </div>
        <div className="session">
          <ThemeSwitcher compact />
          <span>{lastUpdated ? `Updated ${lastUpdated}` : ""}</span>
          <button type="button" onClick={() => void refreshPage()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="routes" aria-label="Laundry scanner">
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
              <h2>Intake capture</h2>
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
                {saving ? "Saving…" : "Capture intake"}
              </button>
            </form>
          </>
        ) : null}

        {route === "scan" ? (
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
            {scanDraft.action === "complete_washing" ? (
              <label className="field">
                Wash load / workflow reference
                <input
                  value={scanDraft.workflow_reference}
                  onChange={(event) =>
                    setScanDraft({
                      ...scanDraft,
                      workflow_reference: event.target.value,
                    })
                  }
                  required
                />
              </label>
            ) : null}
            <button type="submit" disabled={saving}>
              {saving ? "Submitting…" : "Submit scan"}
            </button>
            {scanResult ? (
              <div className="result">
                {scanResult.linen_id ? (
                  <div style={{ marginBottom: 12 }}>
                    <LiveTag linenId={scanResult.linen_id} />
                  </div>
                ) : null}
                <pre style={{ margin: 0 }}>{JSON.stringify(scanResult, null, 2)}</pre>
              </div>
            ) : null}
          </form>
        ) : null}

        {route === "bulk" ? (
          <>
            <form className="editor" onSubmit={(event) => void startSession(event)}>
              <h2>Start an RFID bulk session</h2>
              <label className="field">
                Session ID (generated when blank)
                <input
                  value={bulkDraft.session_id}
                  onChange={(event) =>
                    setBulkDraft({ ...bulkDraft, session_id: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Action
                <select
                  value={bulkDraft.action}
                  onChange={(event) =>
                    setBulkDraft({ ...bulkDraft, action: event.target.value })
                  }
                >
                  {SCAN_ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
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
                Expected linen IDs (one per line)
                <textarea
                  value={bulkDraft.expected_ids}
                  onChange={(event) =>
                    setBulkDraft({ ...bulkDraft, expected_ids: event.target.value })
                  }
                />
              </label>
              <button type="submit" disabled={saving}>
                Start session
              </button>
            </form>

            <form
              className="editor"
              onSubmit={(event) => {
                event.preventDefault();
                void submitBulkReads();
              }}
            >
              <h2>Submit reader observations</h2>
              <p className="muted">
                Reader credentials are sent only to the reader-authenticated endpoints
                and are never stored in the browser.
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
              <div className="actions" key={String(row.session_id ?? "")}>
                {row.status === "ACTIVE" ? (
                  <button
                    type="button"
                    onClick={() => void finishSession(String(row.session_id ?? ""))}
                  >
                    Complete {String(row.session_id ?? "")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void reconcileSession(String(row.session_id ?? ""))}
                >
                  Reconcile {String(row.session_id ?? "")}
                </button>
              </div>
            ))}
          </>
        ) : null}

        {route === "wash" ? (
          <>
            <h2>Wash-cycle and tag health</h2>
            <p className="muted">
              Wash counts change only on validated wash completion with a workflow
              reference. Ordinary scans never increment the counter.
            </p>
            <Rows rows={profiles} />
            <Rows rows={tagAlerts as unknown as Array<Record<string, unknown>>} />
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
                  list="laundry-linen-options"
                  value={exceptionDraft.linen_id}
                  onChange={(event) =>
                    setExceptionDraft({ ...exceptionDraft, linen_id: event.target.value })
                  }
                />
                <datalist id="laundry-linen-options">
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
                  {EXCEPTION_ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={saving}>
                Record exception
              </button>
            </form>
            <Rows rows={missingAlerts as unknown as Array<Record<string, unknown>>} />
            {missingAlerts
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

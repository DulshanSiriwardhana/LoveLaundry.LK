import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  API_BASE,
  createTagItem,
  fetchHotelDashboard,
  fetchHotels,
  fetchLaundryDashboard,
  fetchPlatformAnnouncements,
  fetchPlatformAudit,
  fetchPlatformDashboard,
  fetchPlatformOrganizations,
  fetchPlatformSummary,
  fetchPlatformThemes,
  fetchReaderCompatibility,
  fetchTagAlerts,
  getPlatformToken,
  listReaders,
  listScanSessions,
  listTagItems,
  reconcileScanSession,
  registerReader,
  revokeReader,
  saveAnnouncement,
  saveTheme,
  type CompatibilityRow,
  type OrganizationRow,
  type PlatformSummary,
  type TagAlert,
} from "./api";
import {
  getPlatformSession,
  isPlatformAdmin,
  platformLogout,
  type SessionUser,
} from "./auth";
import { LoginScreen } from "./LoginScreen";
import { ThemeSwitcher } from "./ll-theme";
import { LiveTag } from "./components/LiveTag";

type Route =
  | "summary"
  | "organizations"
  | "tags"
  | "readers"
  | "sessions"
  | "dashboards"
  | "announcements"
  | "themes"
  | "audit";

type DashboardScope = "platform" | "hotel" | "laundry";

const ROUTES: Route[] = [
  "summary",
  "organizations",
  "tags",
  "readers",
  "sessions",
  "dashboards",
  "announcements",
  "themes",
  "audit",
];

/** Item choices mirror the backend's structured item-code mapping. */
const TAG_ITEM_TYPES = [
  { value: "bedsheet", label: "Bedsheet (BS)" },
  { value: "pillowcase", label: "Pillowcase (PC)" },
  { value: "towel", label: "Towel (TW)" },
  { value: "duvet cover", label: "Duvet cover (DC)" },
  { value: "bath mat", label: "Bath mat (BM)" },
  { value: "tablecloth", label: "Tablecloth (TC)" },
  { value: "napkin", label: "Napkin (NK)" },
  { value: "robe", label: "Robe (RB)" },
];

const LABELS: Record<Route, string> = {
  summary: "Summary",
  organizations: "Organizations",
  tags: "Linen tags",
  readers: "RFID readers",
  sessions: "Scan sessions",
  dashboards: "Operations dashboards",
  announcements: "Announcements",
  themes: "Themes",
  audit: "Audit trail",
};

function readRoute(): Route {
  if (typeof window === "undefined") {
    return "summary";
  }
  const value = window.location.hash.replace(/^#\/?/, "") as Route;
  return ROUTES.includes(value) ? value : "summary";
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

interface RowAction {
  label: string;
  onClick: () => void;
}

function DataTable({
  rows,
  actions,
  renderCell,
}: {
  rows: Array<Record<string, unknown>>;
  actions?: (row: Record<string, unknown>) => RowAction[];
  renderCell?: (column: string, row: Record<string, unknown>) => ReactNode | undefined;
}) {
  const columns = Array.from(
    new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row))),
  );
  const rowActions = actions ? rows.map((row) => actions(row)) : [];
  if (columns.length === 0) {
    return <p className="empty">The platform API returned no records.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
            {rowActions.length > 0 ? <th>actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(
                row.audit_id ??
                  row.announcement_id ??
                  row.settings_id ??
                  row.linen_id ??
                  row.reader_id ??
                  row.session_id ??
                  index,
              )}
            >
              {columns.map((column) => {
                const custom = renderCell?.(column, row);
                return <td key={column}>{custom !== undefined ? custom : renderValue(row[column])}</td>;
              })}
              {rowActions[index]?.length ? (
                <td>
                  <div className="actions">
                    {rowActions[index].map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tiles({ value }: { value: Record<string, unknown> }) {
  return (
    <div className="tiles">
      {Object.entries(value)
        .filter(([, item]) => item !== null && typeof item !== "object")
        .map(([name, count]) => (
          <article key={name}>
            <p>{name}</p>
            <strong>{renderValue(count)}</strong>
          </article>
        ))}
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<SessionUser | null>(() => getPlatformSession());
  // Confirmed session expiry from the API layer: drop the in-memory session
  // so the login screen renders without a full page reload.
  useEffect(() => {
    const onExpired = () => setSession(null);
    window.addEventListener("ll:session-expired", onExpired);
    return () => window.removeEventListener("ll:session-expired", onExpired);
  }, []);

  const [token, setToken] = useState<string | null>(() => getPlatformToken());
  const [route, setRoute] = useState<Route>(() => readRoute());
  const [data, setData] = useState<unknown>(null);
  const [aux, setAux] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState({ title: "", body: "", applications: "" });
  const [theme, setTheme] = useState({ scope: "global", theme: '{"primary":"#00008B"}' });
  const [dashboardScope, setDashboardScope] = useState<DashboardScope>("platform");
  const [dashboardOrganization, setDashboardOrganization] = useState("");
  const [tagOrganizations, setTagOrganizations] = useState<OrganizationRow[]>([]);
  const [tagHotelsError, setTagHotelsError] = useState("");
  const [tagDraft, setTagDraft] = useState({
    organization_id: "",
    item_type: "bedsheet",
    category: "bedsheet",
    start_number: 1,
  });
  const [readerDraft, setReaderDraft] = useState({
    reader_id: "",
    organization_id: "",
    name: "",
    adapter: "zebra",
    transport: "tcp",
    endpoint: "",
  });

  const authorized = isPlatformAdmin(session, token);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAux(null);
    try {
      switch (route) {
        case "summary":
          setData(await fetchPlatformSummary());
          break;
        case "organizations":
          setData(await fetchPlatformOrganizations());
          break;
        case "tags": {
          const [items, alerts] = await Promise.all([
            listTagItems(500),
            fetchTagAlerts(),
          ]);
          setData(items);
          setAux(alerts);
          // The owning hotel must come from the hotels list. Loading it on its
          // own keeps the dropdown usable even if another tag API fails.
          try {
            const hotels = await fetchHotels();
            setTagHotelsError("");
            setTagOrganizations(
              hotels
                .map((hotel) => ({
                  organization_id: hotel.hotel_id ?? String(hotel.id ?? ""),
                  name: hotel.name,
                  type: "hotel",
                  status: hotel.status ?? "",
                  hotel_code: hotel.hotel_code ?? "",
                }))
                .filter((hotel) => hotel.organization_id),
            );
          } catch {
            setTagOrganizations([]);
            setTagHotelsError("Could not load hotels from the hotels list.");
          }
          break;
        }
        case "readers": {
          const [readers, compatibility] = await Promise.all([
            listReaders(),
            fetchReaderCompatibility(),
          ]);
          setData(readers);
          setAux(compatibility);
          break;
        }
        case "sessions":
          setData(await listScanSessions());
          break;
        case "dashboards":
          if (dashboardScope === "platform") {
            setData(await fetchPlatformDashboard());
          } else if (dashboardScope === "hotel") {
            setData(await fetchHotelDashboard(dashboardOrganization.trim()));
          } else {
            setData(await fetchLaundryDashboard(dashboardOrganization.trim()));
          }
          break;
        case "announcements":
          setData(await fetchPlatformAnnouncements());
          break;
        case "themes":
          setData(await fetchPlatformThemes());
          break;
        case "audit":
          setData(await fetchPlatformAudit());
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load platform data");
    } finally {
      setLoading(false);
    }
  }, [dashboardOrganization, dashboardScope, route]);

  useEffect(() => {
    if (!authorized) {
      return;
    }
    void load();
  }, [authorized, load]);

  const onAuthenticated = (user: SessionUser) => {
    setSession(user);
    setToken(getPlatformToken());
    setError(null);
  };

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
    platformLogout();
    setSession(null);
    setToken(null);
    setData(null);
    setAux(null);
  };

  const submitAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await saveAnnouncement({
        title: announcement.title.trim(),
        body: announcement.body.trim(),
        applications: announcement.applications
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setAnnouncement({ title: "", body: "", applications: "" });
      setNotice("Announcement stored by the platform API.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save announcement");
    }
  };

  const submitTheme = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const parsed = JSON.parse(theme.theme) as Record<string, unknown>;
      await saveTheme({ scope: theme.scope, theme: parsed });
      setNotice("Theme settings stored by the platform API.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save theme");
    }
  };

  const submitTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const created = await createTagItem({
        ...tagDraft,
        organization_id: tagDraft.organization_id.trim(),
        item_type: tagDraft.item_type.trim(),
        category: tagDraft.category.trim(),
        start_number: Math.max(1, Number(tagDraft.start_number) || 1),
      });
      setNotice(`Created ${created.linen_id} with one permanent identity.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag");
    }
  };

  const downloadSheet = async (linenId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/tags/${encodeURIComponent(linenId)}/sheet`,
        {
          headers: getPlatformToken()
            ? { Authorization: `Bearer ${getPlatformToken()}` }
            : {},
        },
      );
      if (!response.ok) {
        throw new Error(`Tag sheet request failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${linenId}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download tag sheet");
    }
  };

  const submitReader = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const registered = await registerReader({
        ...readerDraft,
        reader_id: readerDraft.reader_id.trim(),
        organization_id: readerDraft.organization_id.trim(),
        name: readerDraft.name.trim(),
        endpoint: readerDraft.endpoint.trim(),
      });
      setNotice(
        `Registered ${registered.reader_id}. Store its API key on the reader; it is shown once.`,
      );
      setReaderDraft({
        reader_id: "",
        organization_id: readerDraft.organization_id,
        name: "",
        adapter: readerDraft.adapter,
        transport: readerDraft.transport,
        endpoint: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register reader");
    }
  };

  const removeReader = async (readerId: string) => {
    setError(null);
    setNotice(null);
    try {
      await revokeReader(readerId);
      setNotice(`${readerId} revoked. Existing credentials can no longer authenticate.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke reader");
    }
  };

  const reconcile = async (sessionId: string) => {
    setError(null);
    setNotice(null);
    try {
      const result = await reconcileScanSession(sessionId);
      setNotice(`${sessionId}: ${renderValue(result)}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reconcile session");
    }
  };

  if (!session) {
    return <LoginScreen onAuthenticated={onAuthenticated} />;
  }

  if (!authorized) {
    return (
      <main className="login-shell">
        <section className="login-card" role="alert">
          <p className="eyebrow">Access denied</p>
          <h1>Platform administrator access required</h1>
          <p className="muted">
            The signed-in account does not carry PLATFORM_ADMIN. No platform data was requested.
          </p>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  const summary = route === "summary" ? (data as PlatformSummary | null) : null;
  const rows = Array.isArray(data)
    ? (data as Array<Record<string, unknown>>)
    : [];
  const alerts = route === "tags" ? ((aux ?? []) as TagAlert[]) : [];
  const compatibility =
    route === "readers" ? ((aux ?? []) as CompatibilityRow[]) : [];

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">LoveLaundry ecosystem</p>
          <h1>Platform Admin</h1>
        </div>
        <div className="session">
          <ThemeSwitcher compact />
          <span>{lastUpdated ? `Updated ${lastUpdated}` : ""}</span>
          <button type="button" onClick={() => void refreshPage()} disabled={refreshing || loading}>
            {refreshing || loading ? "Refreshing…" : "Refresh"}
          </button>
          <span>{session.user_name}</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="routes" aria-label="Platform administration">
        {ROUTES.map((item) => (
          <a
            key={item}
            href={`#/${item}`}
            className={item === route ? "active" : ""}
            aria-current={item === route ? "page" : undefined}
          >
            {LABELS[item]}
          </a>
        ))}
      </nav>

      <main className="content">
        <div className="section-heading">
          <h2>{LABELS[route]}</h2>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}

        {route === "summary" ? (
          summary ? (
            <>
              <Tiles
                value={{ ...summary.counts, audit_entries: summary.audit_entries }}
              />
            </>
          ) : (
            <p className="empty">Loading platform counts…</p>
          )
        ) : null}

        {route === "dashboards" ? (
          <div className="editor">
            <label>
              Dashboard scope
              <select
                value={dashboardScope}
                onChange={(event) =>
                  setDashboardScope(event.target.value as DashboardScope)
                }
              >
                <option value="platform">Platform</option>
                <option value="hotel">Hotel</option>
                <option value="laundry">Laundry</option>
              </select>
            </label>
            {dashboardScope !== "platform" ? (
              <label>
                Organization ID (optional for platform admins)
                <input
                  value={dashboardOrganization}
                  onChange={(event) => setDashboardOrganization(event.target.value)}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {data && typeof data === "object" && !Array.isArray(data) ? (
          <Tiles value={data as Record<string, unknown>} />
        ) : null}

        {route === "tags" ? (
          <>
            <DataTable
              rows={rows}
              renderCell={(column, row) => {
                if (column === "linen_id") {
                  const linenId = String(row.linen_id ?? "").trim();
                  return linenId ? <LiveTag linenId={linenId} compact /> : undefined;
                }
                return undefined;
              }}
              actions={(row) => [
                {
                  label: "QR sheet",
                  onClick: () => void downloadSheet(String(row.linen_id ?? "")),
                },
              ]}
            />
            <div className="editor">
              <h3>Tag health alerts</h3>
              {alerts.length > 0 ? (
                <DataTable
                  rows={alerts as unknown as Array<Record<string, unknown>>}
                />
              ) : (
                <p className="empty">No inspection or replacement alerts.</p>
              )}
            </div>
            <form className="editor" onSubmit={(event) => void submitTag(event)}>
              <h3>Create one permanent linen identity</h3>
              <label>
                Owning hotel record
                <select
                  value={tagDraft.organization_id}
                  onChange={(event) =>
                    setTagDraft({ ...tagDraft, organization_id: event.target.value })
                  }
                  required
                >
                  <option value="">Select a hotel</option>
                  {tagOrganizations.map((org) => (
                    <option key={org.organization_id} value={org.organization_id}>
                      {org.name}{org.hotel_code ? ` — ${org.hotel_code}` : " — no code"}
                    </option>
                  ))}
                </select>
              </label>
              {tagHotelsError ? <p className="empty" role="alert">{tagHotelsError}</p> : null}
              <label>
                Item type
                <select
                  value={tagDraft.item_type}
                  onChange={(event) =>
                    setTagDraft({
                      ...tagDraft,
                      item_type: event.target.value,
                      category: event.target.value,
                    })
                  }
                  required
                >
                  {TAG_ITEM_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Start number
                <input
                  type="number"
                  min={1}
                  max={259974}
                  value={tagDraft.start_number}
                  onChange={(event) =>
                    setTagDraft({
                      ...tagDraft,
                      start_number: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                  required
                />
              </label>
              <p className="empty">
                The hotel code is read from the selected record. Example: bedsheets at
                hotel code G start at 1 produce BSG-A0001XL.
              </p>
              <button type="submit">Create tag identity</button>
            </form>
          </>
        ) : null}

        {route === "readers" ? (
          <>
            <DataTable
              rows={rows}
              actions={(row) =>
                row.revoked
                  ? []
                  : [
                      {
                        label: "Revoke",
                        onClick: () => void removeReader(String(row.reader_id ?? "")),
                      },
                    ]
              }
            />
            <div className="editor">
              <h3>Hardware compatibility matrix</h3>
              <DataTable
                rows={compatibility as unknown as Array<Record<string, unknown>>}
              />
            </div>
            <form className="editor" onSubmit={(event) => void submitReader(event)}>
              <h3>Register a reader</h3>
              <label>
                Reader ID
                <input
                  value={readerDraft.reader_id}
                  onChange={(event) =>
                    setReaderDraft({ ...readerDraft, reader_id: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                Organization ID
                <input
                  value={readerDraft.organization_id}
                  onChange={(event) =>
                    setReaderDraft({ ...readerDraft, organization_id: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                Name
                <input
                  value={readerDraft.name}
                  onChange={(event) =>
                    setReaderDraft({ ...readerDraft, name: event.target.value })
                  }
                />
              </label>
              <label>
                Adapter
                <select
                  value={readerDraft.adapter}
                  onChange={(event) =>
                    setReaderDraft({ ...readerDraft, adapter: event.target.value })
                  }
                >
                  <option value="zebra">Zebra</option>
                  <option value="chainway">Chainway</option>
                  <option value="generic_uhf">Generic UHF</option>
                </select>
              </label>
              <label>
                Transport
                <select
                  value={readerDraft.transport}
                  onChange={(event) =>
                    setReaderDraft({ ...readerDraft, transport: event.target.value })
                  }
                >
                  <option value="tcp">TCP</option>
                  <option value="serial">Serial</option>
                </select>
              </label>
              <label>
                Endpoint
                <input
                  value={readerDraft.endpoint}
                  onChange={(event) =>
                    setReaderDraft({ ...readerDraft, endpoint: event.target.value })
                  }
                  placeholder="host:port or serial device path"
                />
              </label>
              <button type="submit">Register reader</button>
            </form>
          </>
        ) : null}

        {route === "sessions" ? (
          <DataTable
            rows={rows}
            actions={(row) =>
              row.status === "ACTIVE"
                ? [
                    {
                      label: "Reconcile",
                      onClick: () => void reconcile(String(row.session_id ?? "")),
                    },
                  ]
                : []
            }
          />
        ) : null}

        {route !== "summary" &&
        route !== "tags" &&
        route !== "readers" &&
        route !== "sessions" &&
        route !== "dashboards" &&
        rows.length > 0 ? (
          <DataTable rows={rows} />
        ) : null}

        {route === "announcements" ? (
          <form className="editor" onSubmit={(event) => void submitAnnouncement(event)}>
            <h3>New announcement</h3>
            <label>
              Title
              <input
                value={announcement.title}
                onChange={(event) =>
                  setAnnouncement({ ...announcement, title: event.target.value })
                }
              />
            </label>
            <label>
              Body
              <textarea
                value={announcement.body}
                onChange={(event) =>
                  setAnnouncement({ ...announcement, body: event.target.value })
                }
              />
            </label>
            <label>
              Applications (comma separated)
              <input
                value={announcement.applications}
                onChange={(event) =>
                  setAnnouncement({ ...announcement, applications: event.target.value })
                }
              />
            </label>
            <button type="submit">Publish announcement</button>
          </form>
        ) : null}

        {route === "themes" ? (
          <form className="editor" onSubmit={(event) => void submitTheme(event)}>
            <h3>Theme settings</h3>
            <label>
              Scope
              <input
                value={theme.scope}
                onChange={(event) => setTheme({ ...theme, scope: event.target.value })}
              />
            </label>
            <label>
              Theme JSON
              <textarea
                value={theme.theme}
                onChange={(event) => setTheme({ ...theme, theme: event.target.value })}
              />
            </label>
            <button type="submit">Save theme</button>
          </form>
        ) : null}
      </main>
    </div>
  );
}

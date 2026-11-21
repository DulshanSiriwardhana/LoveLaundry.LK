import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  fetchPlatformAnnouncements,
  fetchPlatformAudit,
  fetchPlatformOrganizations,
  fetchPlatformSummary,
  fetchPlatformThemes,
  getPlatformToken,
  saveAnnouncement,
  saveTheme,
  type PlatformSummary,
} from "./api";
import {
  getPlatformSession,
  isPlatformAdmin,
  platformLogout,
  type SessionUser,
} from "./auth";
import { LoginScreen } from "./LoginScreen";

type Route = "summary" | "organizations" | "announcements" | "themes" | "audit";

const ROUTES: Route[] = [
  "summary",
  "organizations",
  "announcements",
  "themes",
  "audit",
];

const LABELS: Record<Route, string> = {
  summary: "Summary",
  organizations: "Organizations",
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

export function App() {
  const [session, setSession] = useState<SessionUser | null>(() => getPlatformSession());
  const [token, setToken] = useState<string | null>(() => getPlatformToken());
  const [route, setRoute] = useState<Route>(() => readRoute());
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState({ title: "", body: "", applications: "" });
  const [theme, setTheme] = useState({ scope: "global", theme: '{"primary":"#2563eb"}' });

  const authorized = isPlatformAdmin(session, token);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (route === "summary") {
        setData(await fetchPlatformSummary());
      } else if (route === "organizations") {
        setData(await fetchPlatformOrganizations());
      } else if (route === "announcements") {
        setData(await fetchPlatformAnnouncements());
      } else if (route === "themes") {
        setData(await fetchPlatformThemes());
      } else {
        setData(await fetchPlatformAudit());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load platform data");
    } finally {
      setLoading(false);
    }
  }, [route]);

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

  const signOut = () => {
    platformLogout();
    setSession(null);
    setToken(null);
    setData(null);
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
  const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">LoveLaundry ecosystem</p>
          <h1>Platform Admin</h1>
        </div>
        <div className="session">
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
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}

        {route === "summary" ? (
          summary ? (
            <div className="tiles">
              {Object.entries(summary.counts).map(([name, count]) => (
                <article key={name}>
                  <p>{name}</p>
                  <strong>{count}</strong>
                </article>
              ))}
              <article>
                <p>audit_entries</p>
                <strong>{summary.audit_entries}</strong>
              </article>
            </div>
          ) : (
            <p className="empty">Loading platform counts…</p>
          )
        ) : null}

        {route !== "summary" && columns.length > 0 ? (
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
                  <tr key={String(row.audit_id ?? row.announcement_id ?? row.settings_id ?? index)}>
                    {columns.map((column) => (
                      <td key={column}>{renderValue(row[column])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : route !== "summary" && !loading ? (
          <p className="empty">The platform API returned no records.</p>
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

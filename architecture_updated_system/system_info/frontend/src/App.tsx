import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type DependencyGraph,
  type Health,
  type Route,
  type ServiceDetail,
  type ServiceSummary,
  type Summary,
} from "./api";

type Tab = "overview" | "services" | "routes" | "dependencies";

export default function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [health, setHealth] = useState<Health | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selected, setSelected] = useState<ServiceDetail | null>(null);
  const [deps, setDeps] = useState<DependencyGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [h, s, d] = await Promise.all([api.health(), api.summary(), api.dependencies()]);
      setHealth(h);
      setSummary(s);
      setDeps(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rescan = async () => {
    setBusy(true);
    setError(null);
    try {
      setSummary(await api.rescan());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openService = async (name: string) => {
    try {
      setSelected(await api.service(name));
      setTab("routes");
      setFilter("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const filteredRoutes: Route[] = useMemo(() => {
    if (!selected) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return selected.routes;
    return selected.routes.filter(
      (r) =>
        r.path.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q) ||
        r.file.toLowerCase().includes(q)
    );
  }, [selected, filter]);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>LoveLaundry · System Info</h1>
          <p className="muted">
            Bounded, read-only architecture intelligence. Never exposes secrets.
          </p>
        </div>
        <div className="actions">
          <StatusPill health={health} />
          <button onClick={rescan} disabled={busy}>
            {busy ? "Scanning…" : "Re-scan"}
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <nav className="tabs">
        {(["overview", "services", "routes", "dependencies"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "tab active" : "tab"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "overview" && <Overview summary={summary} health={health} />}
      {tab === "services" && <Services summary={summary} onOpen={openService} />}
      {tab === "routes" && (
        <RoutesView selected={selected} filter={filter} setFilter={setFilter} routes={filteredRoutes} />
      )}
      {tab === "dependencies" && <Dependencies deps={deps} />}
    </div>
  );
}

function StatusPill({ health }: { health: Health | null }) {
  if (!health) return <span className="pill">unknown</span>;
  const ok = health.status === "ok" && health.source_available;
  return (
    <span className={ok ? "pill ok" : "pill warn"}>
      {ok ? "scanner ok" : "source unavailable"}
    </span>
  );
}

function Overview({ summary, health }: { summary: Summary | null; health: Health | null }) {
  if (!summary) return <p className="muted">Loading…</p>;
  return (
    <section>
      <div className="cards">
        <Card label="Services" value={summary.service_count} />
        <Card label="Routes" value={summary.route_count} />
        <Card label="Scanner version" value={health?.version ?? "—"} />
        <Card label="Source" value={health?.source_available ? "available" : "unavailable"} />
      </div>
      <p className="mono muted">source_root: {summary.source_root}</p>
      <h2>Services at a glance</h2>
      <ServicesTable services={summary.services} />
    </section>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="card-value">{value}</div>
      <div className="card-label">{label}</div>
    </div>
  );
}

function Services({ summary, onOpen }: { summary: Summary | null; onOpen: (n: string) => void }) {
  if (!summary) return <p className="muted">Loading…</p>;
  return (
    <section>
      <h2>Services</h2>
      <ServicesTable services={summary.services} onOpen={onOpen} />
    </section>
  );
}

function ServicesTable({
  services,
  onOpen,
}: {
  services: ServiceSummary[];
  onOpen?: (n: string) => void;
}) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Service</th>
          <th>Language</th>
          <th>Framework</th>
          <th>Mount</th>
          <th className="num">Routes</th>
          <th className="num">Env vars</th>
          {onOpen && <th />}
        </tr>
      </thead>
      <tbody>
        {services.map((s) => (
          <tr key={s.name}>
            <td className="mono">{s.name}</td>
            <td>{s.language}</td>
            <td>{s.framework}</td>
            <td className="mono">{s.mount_prefix || "/"}</td>
            <td className="num">{s.route_count}</td>
            <td className="num">{s.env_var_names.length}</td>
            {onOpen && (
              <td>
                <button className="link" onClick={() => onOpen(s.name)}>
                  routes →
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RoutesView({
  selected,
  filter,
  setFilter,
  routes,
}: {
  selected: ServiceDetail | null;
  filter: string;
  setFilter: (v: string) => void;
  routes: Route[];
}) {
  if (!selected) return <p className="muted">Pick a service from the Services tab.</p>;
  return (
    <section>
      <h2>
        Routes · <span className="mono">{selected.name}</span>{" "}
        <span className="muted">({selected.routes.length})</span>
      </h2>
      <input
        className="search"
        placeholder="Filter by path, method or file…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <table className="table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r, i) => (
            <tr key={`${r.method}-${r.path}-${i}`}>
              <td>
                <span className={`method m-${r.method.toLowerCase()}`}>{r.method}</span>
              </td>
              <td className="mono">{r.path}</td>
              <td className="mono muted">{r.file}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {routes.length === 0 && <p className="muted">No routes match the filter.</p>}
    </section>
  );
}

function Dependencies({ deps }: { deps: DependencyGraph | null }) {
  if (!deps) return <p className="muted">Loading…</p>;
  return (
    <section>
      <h2>Dependency graph</h2>
      <ul className="deps">
        {deps.edges.map((e, i) => (
          <li key={i}>
            <span className="mono">{e.from}</span> → <span className="mono">{e.to}</span>{" "}
            <span className="muted">via {e.via}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

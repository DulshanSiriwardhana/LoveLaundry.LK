import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createBrowserRouter,
  Link,
  Navigate,
  Outlet,
  RouterProvider,
  useNavigate,
} from "react-router-dom";
import { api, getToken, setToken, type LoginResponse } from "./api";
import { GROUPS, ROUTES } from "./routes";

type AuthUser = LoginResponse["user"];

interface AuthState {
  user: AuthUser | null;
  checked: boolean;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setChecked(true);
      return;
    }
    try {
      const s = await api.authStatus();
      setUser({ id: 0, user_name: s.user_name, role_id: s.role, auth_id: "", status: "" });
    } catch {
      setToken(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({ user, checked, setUser }),
    [user, checked],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function LoginPage() {
  const { setUser } = useAuth();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.login(userName, password);
      setToken(res.access_token);
      setUser(res.user);
      nav("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <h1>LoveLaundry</h1>
        <p className="muted">Sign in to continue</p>
        <input placeholder="User name" value={userName} onChange={(e) => setUserName(e.target.value)} />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="error">{error}</div>}
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}

function Dashboard() {
  return (
    <div>
      <h2>Dashboard</h2>
      <p className="muted">
        Foundation page. Authentication and routing are wired to the recreated
        backend; operational widgets are backlog (see docs/current_checkpoint.md).
      </p>
    </div>
  );
}

function Management() {
  return (
    <div>
      <h2>Management</h2>
      <p className="muted">Foundation page for the management module.</p>
    </div>
  );
}

function BacklogPage() {
  return (
    <div>
      <h2>Not yet recreated</h2>
      <p className="muted">
        This route is registered for parity tracking but its workflow is still on
        the backlog.
      </p>
    </div>
  );
}

function ProtectedRoute() {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function Layout() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">LoveLaundry</div>
        <nav>
          {GROUPS.map((g) => (
            <div key={g} className="nav-group">
              <div className="nav-title">{g}</div>
              {ROUTES.filter((r) => r.group === g).map((r) => (
                <Link key={r.path} to={`/${r.path}`} className="nav-link">
                  {r.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="content">
        <header className="content-head">
          <span className="mono muted">{user?.user_name} · {user?.role_id}</span>
          <button
            className="link"
            onClick={() => {
              setToken(null);
              setUser(null);
              nav("/login", { replace: true });
            }}
          >
            Sign out
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

function buildRouter() {
  return createBrowserRouter([
    { path: "/login", element: <LoginPage /> },
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: "/",
          element: <Layout />,
          children: [
            { index: true, element: <Dashboard /> },
            { path: "dashboard", element: <Dashboard /> },
            { path: "management", element: <Management /> },
            ...ROUTES.filter((r) => !["dashboard", "management"].includes(r.path)).map((r) => ({
              path: r.path,
              element: <BacklogPage />,
            })),
          ],
        },
      ],
    },
  ]);
}

function AppRouter({ router }: { router: ReturnType<typeof createBrowserRouter> }) {
  const { checked } = useAuth();
  if (!checked) return <div className="loading">Loading…</div>;
  return <RouterProvider router={router} />;
}

export default function App() {
  // The router is created once: rebuilding it on every auth change discarded
  // navigation state (including the redirect straight after login).
  const router = useMemo(() => buildRouter(), []);

  return (
    <AuthProvider>
      <AppRouter router={router} />
    </AuthProvider>
  );
}

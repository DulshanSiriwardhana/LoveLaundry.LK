import { useState, type FormEvent } from "react";
import { platformLogin, type SessionUser } from "./auth";

interface LoginScreenProps {
  onAuthenticated: (user: SessionUser) => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userName.trim() || !password) {
      setError("Enter both a username and a password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const user = await platformLogin(userName.trim(), password);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={(event) => void submit(event)}>
        <div className="login-card__header">
          <span className="login-mark" aria-hidden="true">LL</span>
          <p className="eyebrow">Love Laundry · secure access</p>
          <h1>Platform Admin</h1>
          <p className="muted">Restricted to platform administrators.</p>
        </div>

        <label className="field">
          <span>Username</span>
          <input
            autoComplete="username"
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            placeholder="Your username"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        {error ? <p role="alert">{error}</p> : null}

        <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p className="login-card__footer">
          Access is limited to accounts registered for this workspace.
        </p>
      </form>
    </main>
  );
}

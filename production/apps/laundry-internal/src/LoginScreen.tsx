import { useState, type FormEvent } from "react";
import { login, type SessionUser } from "./auth";

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
      const user = await login(userName.trim(), password);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "24rem" }}>
      <h1>Sign in</h1>
      <form onSubmit={(event) => void submit(event)}>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          Username
          <input
            type="text"
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            style={{ display: "block", marginTop: "0.25rem", width: "100%" }}
          />
        </label>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={{ display: "block", marginTop: "0.25rem", width: "100%" }}
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

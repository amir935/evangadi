// Login.jsx — login + register UI
import React, { useState } from "react";
import { useAuth } from "./AuthContext";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.logo}>📋</div>
          <h1 style={styles.title}>Evangadi</h1>
          <p style={styles.subtitle}>Tutor Video Review</p>
        </div>

        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
          >Log in</button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(""); }}
            style={{ ...styles.tab, ...(mode === "register" ? styles.tabActive : {}) }}
          >Create account</button>
        </div>

        <form onSubmit={submit} style={styles.form}>
          {mode === "register" && (
            <label style={styles.field}>
              <span style={styles.label}>Your name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amir"
                style={styles.input}
                required
                autoFocus
              />
            </label>
          )}

          <label style={styles.field}>
            <span style={styles.label}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={styles.input}
              required
              autoFocus={mode === "login"}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              style={styles.input}
              required
              minLength={6}
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={busy} style={styles.submit}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <div style={styles.foot}>
          {mode === "login" ? (
            <span>
              Don't have an account?{" "}
              <button type="button" onClick={() => setMode("register")} style={styles.link}>Register</button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("login")} style={styles.link}>Log in</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 0% 0%, #dbeafe 0%, transparent 50%), radial-gradient(1000px 600px at 100% 0%, #fce7f3 0%, transparent 50%), radial-gradient(900px 500px at 50% 100%, #d1fae5 0%, transparent 55%), #f8fafc",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 20,
    fontFamily: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    color: "#0f172a",
  },
  card: {
    width: "100%", maxWidth: 420,
    background: "#ffffff", borderRadius: 18,
    boxShadow: "0 20px 50px -20px rgba(15,23,42,0.25)",
    padding: 32, border: "1px solid #e2e8f0",
  },
  brand: { textAlign: "center", marginBottom: 22 },
  logo: { fontSize: 40, marginBottom: 8 },
  title: { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em",
    background: "linear-gradient(90deg, #2563eb 0%, #7c3aed 50%, #db2777 100%)",
    WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" },
  subtitle: { margin: "4px 0 0", fontSize: 13, color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" },
  tabs: { display: "flex", gap: 6, marginBottom: 20, background: "#f1f5f9", padding: 4, borderRadius: 10 },
  tab: {
    flex: 1, padding: "8px 12px", borderRadius: 8, border: "none",
    background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600,
    color: "#64748b", fontFamily: "inherit",
  },
  tabActive: { background: "#ffffff", color: "#0f172a", boxShadow: "0 2px 8px -4px rgba(15,23,42,0.15)" },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" },
  input: {
    padding: "11px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
    fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0f172a", background: "#ffffff",
  },
  error: {
    background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c",
    padding: "10px 12px", borderRadius: 8, fontSize: 13,
  },
  submit: {
    marginTop: 6, padding: "12px 16px", borderRadius: 10,
    border: "none", background: "#0f172a", color: "#ffffff",
    fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
  foot: { marginTop: 18, textAlign: "center", fontSize: 13, color: "#64748b" },
  link: {
    background: "transparent", border: "none", color: "#2563eb",
    cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, fontFamily: "inherit",
    textDecoration: "underline",
  },
};
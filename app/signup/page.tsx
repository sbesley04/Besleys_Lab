"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { field, input, primaryButton, errorText } from "../admin/_components/formStyles";
import styles from "../admin/_components/accountArea.module.css";

// Public account creation. Creates a USER via /api/signup, then signs them in
// automatically and sends them home.
export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", name: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not create your account.");
        return;
      }

      // Auto-login with the credentials just created.
      const login = await signIn("credentials", {
        identifier: form.email,
        password: form.password,
        redirect: false,
      });

      if (login?.error) {
        // Account exists but auto-login failed — send them to the login page.
        router.push("/login");
        return;
      }
      // Land new users on their dashboard so saving games/rosters is discoverable.
      router.push("/profile");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.authShell}>
      <form
        onSubmit={handleSubmit}
        className={`paper-card ${styles.authCard} ${styles.staticCard}`}
        aria-busy={loading}
      >
        <div>
          <h1 className={styles.authTitle}>Create account</h1>
          <p style={{ color: "var(--ink-soft)", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
            Join the lab.
          </p>
        </div>

        <label style={field}>
          Username
          <input
            style={input}
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
            autoComplete="username"
            placeholder="3–20 chars: letters, numbers, _"
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9][A-Za-z0-9_]{2,19}"
            required
          />
        </label>

        <label style={field}>
          Email
          <input
            style={input}
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>

        <label style={field}>
          Name <span style={{ fontWeight: 400 }}>(optional)</span>
          <input style={input} value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
        </label>

        <label style={field}>
          Password <span style={{ fontWeight: 400 }}>(8+ characters)</span>
          <input
            style={input}
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        {error && (
          <p role="alert" style={{ ...errorText, fontSize: "0.85rem", margin: 0 }}>
            {error}
          </p>
        )}

        <button type="submit" style={primaryButton} disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>

        <p className={styles.authFooter}>
          Already have an account? <Link className={styles.inlineAction} href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}

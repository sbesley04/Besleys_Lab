"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { field, input, primaryButton } from "../admin/_components/formStyles";

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

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      setError(data.error || "Could not create your account.");
      return;
    }

    // Auto-login with the credentials just created.
    const login = await signIn("credentials", {
      identifier: form.email,
      password: form.password,
      redirect: false,
    });
    setLoading(false);

    if (login?.error) {
      // Account exists but auto-login failed — send them to the login page.
      router.push("/login");
      return;
    }
    // Land new users on their dashboard so saving games/rosters is discoverable.
    router.push("/profile");
    router.refresh();
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <form
        onSubmit={handleSubmit}
        className="paper-card"
        style={{ width: "100%", maxWidth: 400, padding: "2.25rem 2rem", display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", margin: 0 }}>
            Create account
          </h1>
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
            required
          />
        </label>

        <label style={field}>
          Name <span style={{ fontWeight: 400 }}>(optional)</span>
          <input style={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </label>

        <label style={field}>
          Password <span style={{ fontWeight: 400 }}>(8+ characters)</span>
          <input
            style={input}
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        {error && (
          <p role="alert" style={{ color: "#9b3a2f", fontSize: "0.85rem", margin: 0 }}>
            {error}
          </p>
        )}

        <button type="submit" style={primaryButton} disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>

        <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: 0, textAlign: "center" }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}

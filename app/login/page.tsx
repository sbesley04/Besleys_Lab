"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { field, input, primaryButton } from "../admin/_components/formStyles";

// General sign-in for everyone (USER/EDITOR/ADMIN). Accepts an email OR a
// username in a single field. useSearchParams is isolated in LoginForm and
// wrapped in Suspense so the page prerenders cleanly.
export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let res;
    try {
      res = await signIn("credentials", {
        identifier: identifier.trim(),
        password,
        redirect: false,
      });
    } catch {
      setLoading(false);
      setError("Couldn't reach the server — check your connection and try again.");
      return;
    }

    setLoading(false);
    if (res?.error) {
      // NextAuth reports bad credentials as "CredentialsSignin"; anything else
      // is a server-side problem, not the user's typing.
      setError(
        res.error === "CredentialsSignin"
          ? "That email/username and password don't match an account. Both are case-insensitive for the name — check the password carefully."
          : "Sign-in hit a server error. Try again in a moment.",
      );
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="paper-card"
      style={{ width: "100%", maxWidth: 380, padding: "2.25rem 2rem", display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", margin: 0 }}>Sign in</h1>
        <p style={{ color: "var(--ink-soft)", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
          Welcome back to the lab.
        </p>
      </div>

      <label style={field}>
        Email or username
        <input
          style={input}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          autoFocus
          required
        />
      </label>

      <label style={field}>
        Password
        <input
          style={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      {error && (
        <p role="alert" style={{ color: "#9b3a2f", fontSize: "0.85rem", margin: 0 }}>
          {error}
        </p>
      )}

      <button type="submit" style={primaryButton} disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: 0, textAlign: "center" }}>
        No account? <Link href="/signup">Create one</Link>
      </p>
    </form>
  );
}

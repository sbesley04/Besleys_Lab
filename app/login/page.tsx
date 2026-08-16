"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { field, input, primaryButton, errorText } from "../admin/_components/formStyles";
import { safeCallbackPath } from "@/lib/navigation";
import styles from "../admin/_components/accountArea.module.css";

// General sign-in for everyone (USER/EDITOR/ADMIN). Accepts an email OR a
// username in a single field. useSearchParams is isolated in LoginForm and
// wrapped in Suspense so the page prerenders cleanly.
export default function LoginPage() {
  return (
    <main className={styles.authShell}>
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

function LoginFallback() {
  return (
    <div className={`paper-card ${styles.authCard} ${styles.staticCard}`} role="status" aria-live="polite" aria-busy="true">
      <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
      <span>Preparing sign in…</span>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Keep post-login navigation on this site. Protocol-relative, backslash and
  // absolute URL variants would otherwise turn sign-in into an open redirect.
  const callbackUrl = safeCallbackPath(params.get("callbackUrl"));

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
      className={`paper-card ${styles.authCard} ${styles.staticCard}`}
      aria-busy={loading}
    >
      <div>
        <h1 className={styles.authTitle}>Sign in</h1>
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
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "login-error" : undefined}
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
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "login-error" : undefined}
          required
        />
      </label>

      {error && (
        <p id="login-error" role="alert" style={{ ...errorText, fontSize: "0.85rem", margin: 0 }}>
          {error}
        </p>
      )}

      <button type="submit" style={primaryButton} disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p className={styles.authFooter}>
        No account? <Link className={styles.inlineAction} href="/signup">Create one</Link>
      </p>
    </form>
  );
}

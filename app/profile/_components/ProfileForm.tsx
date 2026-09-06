"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { field, input, primaryButton, ghostButton, dangerButton, errorText } from "../../admin/_components/formStyles";
import styles from "../../admin/_components/accountArea.module.css";

// Self-service profile editor. PATCHes /api/profile, then refreshes the session
// so the header/handle update immediately. Password change is optional and
// requires the current password.
export interface ProfileInitial {
  name: string;
  username: string;
  email: string;
}

export default function ProfileForm({
  initial,
  canSelfDelete,
}: {
  initial: ProfileInitial;
  // Whether this account is allowed to delete itself — false for staff
  // (EDITOR/ADMIN), who must be removed by another admin. Mirrors the check
  // in app/api/profile/route.ts's DELETE handler.
  canSelfDelete: boolean;
}) {
  const router = useRouter();
  const { update } = useSession();

  const [name, setName] = useState(initial.name);
  const [username, setUsername] = useState(initial.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);

    const payload: Record<string, string> = { name, username };
    if (newPassword) {
      payload.newPassword = newPassword;
      payload.currentPassword = currentPassword;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not save changes.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setMessage("Profile updated.");
      try {
        await update(); // refresh the JWT/session so the header reflects changes
      } catch {
        setMessage("Profile updated. Refresh the page if the header still shows your old name.");
      }
      router.refresh();
    } catch {
      setError("Network error — your profile was not updated. Your changes are still here.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);

    if (!confirm("Delete your account? This permanently removes your saves, rosters, reviews, and simulation history. This cannot be undone.")) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Could not delete your account.");
        return;
      }

      await signOut({ callbackUrl: "/" });
    } catch {
      setDeleteError("Network error — your account was not deleted. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} aria-busy={saving}>
      <label style={field}>
        Email <span style={{ fontWeight: 400 }}>(can&rsquo;t be changed here)</span>
        <input style={{ ...input, color: "var(--ink-soft)" }} value={initial.email} readOnly aria-readonly="true" />
      </label>

      <label style={field}>
        Username
        <input
          style={input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9][A-Za-z0-9_]{2,19}"
          required
        />
      </label>

      <label style={field}>
        Name <span style={{ fontWeight: 400 }}>(optional)</span>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>

      <fieldset style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "1rem", margin: 0 }}>
        <legend style={{ fontSize: "0.85rem", color: "var(--ink-soft)", padding: "0 0.4rem" }}>
          Change password (optional)
        </legend>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <label style={field}>
            Current password
            <input
              style={input}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required={Boolean(newPassword)}
            />
          </label>
          <label style={field}>
            New password <span style={{ fontWeight: 400 }}>(8+ characters)</span>
            <input
              style={input}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </label>
        </div>
      </fieldset>

      {error && (
        <p role="alert" style={{ ...errorText, fontSize: "0.9rem", margin: 0 }}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" style={{ color: "var(--accent)", fontSize: "0.9rem", margin: 0 }}>{message}</p>
      )}

      <div className={styles.formActions}>
        <button type="submit" style={primaryButton} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" style={ghostButton} disabled={saving} onClick={() => router.push("/profile")}>
          Back
        </button>
      </div>

      {canSelfDelete && (
        <fieldset
          style={{
            border: "1px solid color-mix(in srgb, #b94738 40%, var(--line))",
            borderRadius: 6,
            padding: "1rem",
            margin: 0,
          }}
        >
          <legend style={{ fontSize: "0.85rem", color: "var(--ink-soft)", padding: "0 0.4rem" }}>
            Delete account
          </legend>
          <p style={{ margin: "0 0 0.85rem", fontSize: "0.88rem", color: "var(--ink-soft)" }}>
            Permanently deletes your account and everything tied to it — saved games, rosters,
            simulation history, achievements, and book reviews. This cannot be undone. See the{" "}
            <a href="/privacy">privacy policy</a> for details on how your data is handled.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <label style={field}>
              Confirm your password
              <input
                style={input}
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {deleteError && (
              <p role="alert" style={{ ...errorText, fontSize: "0.9rem", margin: 0 }}>
                {deleteError}
              </p>
            )}
            <button
              type="button"
              style={dangerButton}
              disabled={deleting || !deletePassword}
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </fieldset>
      )}
    </form>
  );
}

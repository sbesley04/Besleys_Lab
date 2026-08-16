"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { field, input, primaryButton, ghostButton, errorText } from "../../admin/_components/formStyles";
import styles from "../../admin/_components/accountArea.module.css";

// Self-service profile editor. PATCHes /api/profile, then refreshes the session
// so the header/handle update immediately. Password change is optional and
// requires the current password.
export interface ProfileInitial {
  name: string;
  username: string;
  email: string;
}

export default function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const router = useRouter();
  const { update } = useSession();

  const [name, setName] = useState(initial.name);
  const [username, setUsername] = useState(initial.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    </form>
  );
}

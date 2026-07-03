"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { field, input, primaryButton, ghostButton } from "../../admin/_components/formStyles";

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

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save changes.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setMessage("Profile updated.");
    await update(); // refresh the JWT/session so the header reflects changes
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <label style={field}>
        Email <span style={{ fontWeight: 400 }}>(can&rsquo;t be changed here)</span>
        <input style={{ ...input, opacity: 0.7 }} value={initial.email} readOnly disabled />
      </label>

      <label style={field}>
        Username
        <input
          style={input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          required
        />
      </label>

      <label style={field}>
        Name <span style={{ fontWeight: 400 }}>(optional)</span>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
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
            />
          </label>
        </div>
      </fieldset>

      {error && (
        <p role="alert" style={{ color: "#9b3a2f", fontSize: "0.9rem", margin: 0 }}>
          {error}
        </p>
      )}
      {message && (
        <p style={{ color: "var(--accent)", fontSize: "0.9rem", margin: 0 }}>{message}</p>
      )}

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button type="submit" style={primaryButton} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" style={ghostButton} onClick={() => router.push("/profile")}>
          Back
        </button>
      </div>
    </form>
  );
}

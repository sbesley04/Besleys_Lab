"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { field, input, primaryButton, ghostButton } from "../../_components/formStyles";

// Create-account form (admin only). Posts to /api/users; on success returns to
// the user list.
export default function UserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "EDITOR" | "USER">("EDITOR");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, name, password, role }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create the account.");
      return;
    }
    router.push("/admin/users");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <label style={field}>
        Email
        <input
          style={input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          required
        />
      </label>

      <label style={field}>
        Username
        <input
          style={input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          placeholder="3–20 chars: letters, numbers, _"
          required
        />
      </label>

      <label style={field}>
        Name <span style={{ fontWeight: 400 }}>(optional)</span>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label style={field}>
        Password <span style={{ fontWeight: 400 }}>(at least 8 characters)</span>
        <input
          style={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>

      <label style={field}>
        Role
        <select
          style={input}
          value={role}
          onChange={(e) => setRole(e.target.value as "ADMIN" | "EDITOR" | "USER")}
        >
          <option value="ADMIN">Admin — full access, manage accounts</option>
          <option value="EDITOR">Editor — manage content, not accounts</option>
          <option value="USER">User — signed-in visitor, no admin access</option>
        </select>
      </label>

      {error && (
        <p role="alert" style={{ color: "#9b3a2f", fontSize: "0.9rem", margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button type="submit" style={primaryButton} disabled={saving}>
          {saving ? "Creating…" : "Create account"}
        </button>
        <button type="button" style={ghostButton} onClick={() => router.push("/admin/users")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

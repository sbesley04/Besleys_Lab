"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dangerButton, errorText } from "../../_components/formStyles";
import styles from "../../_components/accountArea.module.css";

// Client island for deleting an account from the list (admin only).
export default function DeleteUserButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`Delete the account for ${email}? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not delete the account.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — the account was not deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.inlineDelete}>
      <button
        type="button"
        style={{ ...dangerButton, fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
        disabled={busy}
        onClick={handleDelete}
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && <p role="alert" className={styles.inlineError} style={errorText}>{error}</p>}
    </div>
  );
}

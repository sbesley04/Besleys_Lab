"use client";

import { useRouter } from "next/navigation";
import { dangerButton } from "../../_components/formStyles";

// Client island for deleting an account from the list (admin only).
export default function DeleteUserButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete the account for ${email}? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Could not delete the account.");
      return;
    }
    router.refresh();
  }

  return (
    <button type="button" style={{ ...dangerButton, fontSize: "0.8rem", padding: "0.3rem 0.6rem" }} onClick={handleDelete}>
      Delete
    </button>
  );
}

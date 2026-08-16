"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

// Small client island so the otherwise-server admin pages can offer sign-out.
export default function SignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: "/" }).catch(() => setPending(false));
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        fontFamily: "var(--font-body)",
        fontSize: "0.85rem",
        fontWeight: 500,
        padding: "0.4rem 0.8rem",
        border: "1px solid var(--line)",
        borderRadius: 4,
        background: "transparent",
        color: "var(--ink-soft)",
        cursor: pending ? "wait" : "pointer",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

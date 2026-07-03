"use client";

import { signOut } from "next-auth/react";

// Small client island so the otherwise-server admin pages can offer sign-out.
export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "0.85rem",
        fontWeight: 500,
        padding: "0.4rem 0.8rem",
        border: "1px solid var(--line)",
        borderRadius: 4,
        background: "transparent",
        color: "var(--ink-soft)",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}

"use client";

import { SessionProvider } from "next-auth/react";

// Client-side provider so components can call useSession(). Wraps the whole
// app in app/layout.tsx. EXTEND HERE: add other client providers (theme, etc.)
// by nesting them inside this component.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ACHIEVEMENTS_BY_KEY } from "@/lib/achievements";
import { TOAST_EVENT, syncLocalToServer } from "@/lib/arcade";

// Global achievement toast stack. Mounted once in the root layout; any game
// calls unlock() from lib/arcade and a paper-scrap toast slides in here.
// Also flushes locally-earned achievements to the server once per pageview
// when the visitor is signed in.

interface Toast {
  id: number;
  key: string;
}

let nextId = 1;

export default function AchievementToaster() {
  const { status } = useSession();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (status === "authenticated") syncLocalToServer();
  }, [status]);

  useEffect(() => {
    function onUnlock(e: Event) {
      const keys = (e as CustomEvent<{ keys: string[] }>).detail?.keys ?? [];
      const fresh = keys.map((key) => ({ id: nextId++, key }));
      setToasts((t) => [...t, ...fresh]);
      for (const toast of fresh) {
        setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== toast.id));
        }, 5200);
      }
    }
    window.addEventListener(TOAST_EVENT, onUnlock);
    return () => window.removeEventListener(TOAST_EVENT, onUnlock);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        maxWidth: "min(320px, calc(100vw - 2rem))",
      }}
    >
      {toasts.map((t) => {
        const def = ACHIEVEMENTS_BY_KEY.get(t.key);
        if (!def) return null;
        return (
          <div key={t.id} className="paper-card achievement-toast" role="status">
            <span style={{ fontSize: "1.6rem", lineHeight: 1 }} aria-hidden>
              {def.icon}
            </span>
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)" }}>
                Achievement unlocked
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>{def.title}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>{def.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

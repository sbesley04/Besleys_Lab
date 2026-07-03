"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

// Save/load controls shared by every arcade game. Signed-in users get one
// autosave slot per game (backed by /api/saves); guests get a quiet sign-in
// hint instead. The parent supplies `getState` (what to persist) and `onLoad`
// (how to restore it) — the slot never reaches into game internals.

export default function SaveSlot<T>({
  game,
  getState,
  onLoad,
  validate,
}: {
  game: string;
  getState: () => T;
  onLoad: (state: T) => void;
  /** Optional shape check for loaded payloads (old/corrupt saves). */
  validate?: (state: unknown) => state is T;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session?.user) {
    return (
      <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", margin: "0.75rem 0 0" }}>
        <Link href={`/login?callbackUrl=${encodeURIComponent(pathname ?? "/games")}`}>Sign in</Link>{" "}
        to save your progress.
      </p>
    );
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, name: "autosave", data: JSON.stringify(getState()) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(data.error || "Save failed — try again.");
      } else {
        setStatus("Saved ✓");
      }
    } catch {
      setStatus("Save failed — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/saves?game=${encodeURIComponent(game)}&name=autosave`);
      if (res.status === 404) {
        setStatus("No save yet — play a bit, then hit Save.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(data.error || "Couldn't load your save.");
        return;
      }
      const row = await res.json();
      const state = JSON.parse(row.data) as unknown;
      if (validate && !validate(state)) {
        setStatus("That save is from an older version and can't be restored.");
        return;
      }
      onLoad(state as T);
      setStatus("Loaded ✓");
    } catch {
      setStatus("Couldn't load your save — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  const btn: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.85rem",
    padding: "0.4rem 0.8rem",
    border: "1px solid var(--line)",
    borderRadius: 4,
    background: "var(--paper)",
    color: "var(--ink)",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.6 : 1,
  };

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" style={btn} onClick={save} disabled={busy}>
          💾 Save
        </button>
        <button type="button" style={btn} onClick={load} disabled={busy}>
          ⏏ Load
        </button>
      </div>
      {status && (
        <p role="status" style={{ fontSize: "0.8rem", color: "var(--ink-soft)", margin: "0.5rem 0 0" }}>
          {status}
        </p>
      )}
    </div>
  );
}

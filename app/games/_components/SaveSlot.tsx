"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./saveSlot.module.css";

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
  const { data: session, status: sessionStatus } = useSession();
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "load" | null>(null);

  if (sessionStatus === "loading") return null;

  if (!session?.user) {
    return (
      <p className={styles.signInHint}>
        <Link href={`/login?callbackUrl=${encodeURIComponent(pathname ?? "/games")}`}>Sign in</Link>{" "}
        to save your progress.
      </p>
    );
  }

  async function save() {
    setBusy("save");
    setMessage(null);
    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, name: "autosave", data: JSON.stringify(getState()) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || "Save failed — try again.");
      } else {
        setMessage("Saved ✓");
      }
    } catch {
      setMessage("Save failed — check your connection.");
    } finally {
      setBusy(null);
    }
  }

  async function load() {
    setBusy("load");
    setMessage(null);
    try {
      const res = await fetch(`/api/saves?game=${encodeURIComponent(game)}&name=autosave`);
      if (res.status === 404) {
        setMessage("No save yet — play a bit, then hit Save.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || "Couldn't load your save.");
        return;
      }
      const row = await res.json();
      const state = JSON.parse(row.data) as unknown;
      if (validate && !validate(state)) {
        setMessage("That save is from an older version and can't be restored.");
        return;
      }
      onLoad(state as T);
      setMessage("Loaded ✓");
    } catch {
      setMessage("Couldn't load your save — check your connection.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.slot} aria-busy={busy !== null}>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={save} disabled={busy !== null}>
          {busy === "save" ? "Saving…" : "💾 Save"}
        </button>
        <button type="button" className={styles.button} onClick={load} disabled={busy !== null}>
          {busy === "load" ? "Loading…" : "⏏ Load"}
        </button>
      </div>
      {message ? <p role="status" className={styles.status}>{message}</p> : null}
    </div>
  );
}

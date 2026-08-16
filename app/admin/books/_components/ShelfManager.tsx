"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Spine } from "@/app/library/_components/BookSpine";
import { Decor } from "@/app/library/_components/ShelfDecor";
import { MAX_SHELVES, MAX_BOOKCASES, DECOR_KINDS, DECOR_LABELS, type DecorKind } from "@/lib/library";
import { errorText } from "../../_components/formStyles";
import styles from "../../_components/accountArea.module.css";

// Admin shelf arrangement across bookcases. Books and decor share each
// shelf's position space, so one set of ←/→/↑/↓ controls moves either kind.
// Tabs switch bookcases; cases can be added and renamed here. Every move PUTs
// to the item's endpoint, then the whole list refetches so the view always
// mirrors the database.

interface BookRow {
  id: string;
  slug: string;
  title: string;
  author: string;
  color: string;
  height: number;
  thickness: number;
  design: string;
  bookcase: number;
  shelf: number;
  position: number;
  published: boolean;
}

interface DecorRow {
  id: string;
  kind: string;
  bookcase: number;
  shelf: number;
  position: number;
}

interface CaseRow {
  idx: number;
  name: string;
}

type Thing =
  | ({ type: "book" } & BookRow)
  | ({ type: "decor" } & DecorRow);

const btn: React.CSSProperties = {
  display: "inline-flex",
  minWidth: 44,
  minHeight: 44,
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
  padding: "0.3rem 0.6rem",
  border: "1px solid var(--line)",
  borderRadius: 4,
  background: "var(--paper)",
  color: "var(--ink)",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  minWidth: 0,
  minHeight: 44,
  fontFamily: "var(--font-body)",
  fontSize: "0.9rem",
  padding: "0.4rem 0.6rem",
  border: "1px solid var(--line)",
  borderRadius: 4,
  background: "var(--paper)",
  color: "var(--ink)",
};

export default function ShelfManager() {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [decor, setDecor] = useState<DecorRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeCase, setActiveCase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [decorKind, setDecorKind] = useState<DecorKind>("snake-plant");
  const [decorShelf, setDecorShelf] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [bRes, dRes, cRes] = await Promise.all([
        fetch("/api/books"),
        fetch("/api/decor"),
        fetch("/api/bookcases"),
      ]);
      if (!bRes.ok || !dRes.ok || !cRes.ok) {
        setError("Couldn't load the shelf.");
        return;
      }
      setBooks(await bRes.json());
      setDecor(await dRes.json());
      setCases(await cRes.json());
      setError(null);
    } catch {
      setError("Couldn't load the shelf — check your connection.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Case pages = explicit Bookcase rows plus anything referenced by content.
  const pages = [
    ...new Set([0, ...cases.map((c) => c.idx), ...books.map((b) => b.bookcase), ...decor.map((d) => d.bookcase)]),
  ].sort((a, b) => a - b);

  useEffect(() => {
    setRenameValue(cases.find((c) => c.idx === activeCase)?.name ?? "");
  }, [activeCase, cases]);

  async function api(path: string, method: string, body?: unknown) {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Request failed.");
    }
    return res.json();
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    let requestError: string | null = null;
    try {
      await fn();
    } catch (e) {
      requestError = e instanceof Error ? e.message : "Something went wrong.";
    } finally {
      await refresh();
      if (requestError) setError(requestError);
      setBusy(false);
    }
  }

  function moveEndpoint(t: Thing): [string, Record<string, unknown>] {
    return t.type === "book"
      ? [`/api/books/${t.id}`, { move: true }]
      : [`/api/decor/${t.id}`, {}];
  }

  /** Swap a thing with its neighbour on the same shelf. */
  function swap(things: Thing[], index: number, dir: -1 | 1) {
    const b = things[index + dir];
    const a = things[index];
    if (!a || !b) return;
    void run(async () => {
      const reordered = [...things];
      [reordered[index], reordered[index + dir]] = [b, a];
      // Keep SQLite writes ordered while normalizing every position. This also
      // repairs legacy shelves where a book and a plant shared the same slot.
      for (const [position, thing] of reordered.entries()) {
        const [path, extra] = moveEndpoint(thing);
        await api(path, "PUT", { ...extra, position });
      }
    });
  }

  /** Move a thing to the end of an adjacent shelf in the active case. */
  function changeShelf(t: Thing, dir: -1 | 1) {
    const target = t.shelf + dir;
    if (target < 0 || target >= MAX_SHELVES) return;
    const end = Math.max(
      -1,
      ...books.filter((b) => b.bookcase === activeCase && b.shelf === target).map((b) => b.position),
      ...decor.filter((d) => d.bookcase === activeCase && d.shelf === target).map((d) => d.position),
    );
    void run(async () => {
      const [path, extra] = moveEndpoint(t);
      await api(path, "PUT", { ...extra, shelf: target, position: end + 1 });
    });
  }

  function addDecor() {
    void run(() => api("/api/decor", "POST", { kind: decorKind, bookcase: activeCase, shelf: decorShelf }));
  }

  function removeDecor(id: string) {
    void run(() => api(`/api/decor/${id}`, "DELETE"));
  }

  function addBookcase() {
    void run(() => api("/api/bookcases", "POST", { name: "" }));
  }

  function renameCase() {
    void run(() => api("/api/bookcases", "POST", { idx: activeCase, name: renameValue }));
  }

  if (!loaded) {
    return <p role="status" aria-live="polite" style={{ color: "var(--ink-soft)" }}>{error ?? "Loading the shelf…"}</p>;
  }

  const caseBooks = books.filter((b) => b.bookcase === activeCase);
  const caseDecor = decor.filter((d) => d.bookcase === activeCase);
  const shelfIndexes = [
    ...new Set([...caseBooks.map((b) => b.shelf), ...caseDecor.map((d) => d.shelf)]),
  ].sort((a, b) => a - b);

  return (
    <div className={styles.manager} aria-busy={busy}>
      {/* --- Bookcase tabs --- */}
      <div className={styles.tabRow} role="group" aria-label="Bookcases">
        {pages.map((idx) => {
          const name = cases.find((c) => c.idx === idx)?.name;
          const active = idx === activeCase;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveCase(idx)}
              style={{
                ...btn,
                borderRadius: 999,
                padding: "0.35rem 0.9rem",
                fontWeight: active ? 600 : 400,
                background: active ? "var(--accent)" : "var(--paper)",
                color: active ? "var(--paper)" : "var(--ink)",
                borderColor: active ? "var(--accent)" : "var(--line)",
              }}
              aria-pressed={active}
            >
              {name || `Bookcase ${idx + 1}`}
            </button>
          );
        })}
        {pages.length < MAX_BOOKCASES && (
          <button type="button" style={btn} onClick={addBookcase} disabled={busy}>
            + Add bookcase
          </button>
        )}
      </div>

      {/* --- Case tools --- */}
      <div className={`paper-card ${styles.toolPanel} ${styles.staticCard}`}>
        <div className={styles.toolGroup}>
          <label htmlFor="bookcase-name">Bookcase name</label>
          <input
            id="bookcase-name"
            style={inputStyle}
            className={styles.compactControl}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder={`Bookcase ${activeCase + 1}`}
            maxLength={40}
          />
          <button type="button" style={btn} onClick={renameCase} disabled={busy}>
            Save
          </button>
        </div>

        <div className={styles.decorTools}>
          <span>Add shelf decor</span>
          <select
            style={inputStyle}
            className={styles.compactControl}
            aria-label="Shelf decor type"
            value={decorKind}
            onChange={(e) => setDecorKind(e.target.value as DecorKind)}
          >
            {DECOR_KINDS.map((k) => (
              <option key={k} value={k}>
                {DECOR_LABELS[k]}
              </option>
            ))}
          </select>
          <label className={styles.inlineSelectLabel}>
            Shelf
            <select
              style={inputStyle}
              aria-label="Shelf number"
              value={decorShelf}
              onChange={(e) => setDecorShelf(Number(e.target.value))}
            >
              {Array.from({ length: MAX_SHELVES }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <button type="button" style={btn} onClick={addDecor} disabled={busy}>
            Add decor
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" style={{ ...errorText, fontSize: "0.9rem", margin: 0 }}>
          {error}
        </p>
      )}

      {/* --- Shelves --- */}
      {shelfIndexes.length === 0 ? (
        <div className={`paper-card ${styles.staticCard}`} style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--ink-soft)" }}>
            This bookcase is empty. <Link href="/admin/books/new">Add a book</Link> (pick this
            bookcase in the editor) or add shelf decor above.
          </p>
        </div>
      ) : (
        shelfIndexes.map((idx) => {
          const things: Thing[] = [
            ...caseBooks.filter((b) => b.shelf === idx).map((b): Thing => ({ type: "book", ...b })),
            ...caseDecor.filter((d) => d.shelf === idx).map((d): Thing => ({ type: "decor", ...d })),
          ].sort((a, b) => a.position - b.position);

          return (
            <section key={idx} className={`paper-card ${styles.shelfCard} ${styles.staticCard}`} aria-label={`Shelf ${idx + 1}`}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", margin: "0 0 1rem" }}>
                Shelf {idx + 1}
              </h2>
              <ul className={styles.shelfList}>
                {things.map((t, i) => (
                  <li
                    key={t.id}
                    className={styles.shelfRow}
                  >
                    {t.type === "book" ? (
                      <>
                        <span aria-hidden="true"><Spine book={t} scale={0.3} /></span>
                        <div className={styles.shelfIdentity}>
                          <Link href={`/admin/books/${t.id}`} style={{ fontWeight: 600, color: "var(--ink)" }}>
                            {t.title}
                          </Link>
                          <div style={{ color: "var(--ink-soft)", fontSize: "0.82rem" }}>
                            {t.author}
                            {!t.published && <span style={{ ...errorText, marginLeft: "0.5rem" }}>· hidden</span>}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true" style={{ transform: "scale(0.75)", transformOrigin: "left bottom", display: "inline-flex" }}>
                          <Decor kind={t.kind} />
                        </span>
                        <div className={styles.shelfIdentity}>
                          <span style={{ fontWeight: 600 }}>{DECOR_LABELS[t.kind as DecorKind] ?? t.kind}</span>
                          <div style={{ color: "var(--ink-soft)", fontSize: "0.82rem" }}>shelf decor</div>
                        </div>
                      </>
                    )}
                    <div className={styles.itemControls} role="group" aria-label={`Move ${t.type === "book" ? t.title : "decor"}`}>
                      <button type="button" className={styles.smallButton} style={btn} disabled={busy || i === 0} onClick={() => swap(things, i, -1)} title="Move left" aria-label={`Move ${t.type === "book" ? t.title : "decor"} left`}>
                        ←
                      </button>
                      <button
                        type="button"
                        className={styles.smallButton}
                        style={btn}
                        disabled={busy || i === things.length - 1}
                        onClick={() => swap(things, i, 1)}
                        title="Move right"
                        aria-label={`Move ${t.type === "book" ? t.title : "decor"} right`}
                      >
                        →
                      </button>
                      <button type="button" className={styles.smallButton} style={btn} disabled={busy || idx === 0} onClick={() => changeShelf(t, -1)} title="Move up a shelf" aria-label={`Move ${t.type === "book" ? t.title : "decor"} up a shelf`}>
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.smallButton}
                        style={btn}
                        disabled={busy || idx >= MAX_SHELVES - 1}
                        onClick={() => changeShelf(t, 1)}
                        title="Move down a shelf"
                        aria-label={`Move ${t.type === "book" ? t.title : "decor"} down a shelf`}
                      >
                        ↓
                      </button>
                      {t.type === "decor" && (
                        <button
                          type="button"
                          className={styles.smallButton}
                          style={{ ...btn, ...errorText, borderColor: "color-mix(in srgb, #b94738 55%, var(--line))" }}
                          disabled={busy}
                          onClick={() => removeDecor(t.id)}
                          title="Remove decor"
                          aria-label="Remove decor"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <p style={{ color: "var(--ink-soft)", fontSize: "0.82rem", margin: 0 }}>
        ← → reorder within a shelf · ↑ ↓ move between shelves. Shelf decor moves with the same controls.
        To move a book to another bookcase, open its editor and change the bookcase there.
      </p>
    </div>
  );
}

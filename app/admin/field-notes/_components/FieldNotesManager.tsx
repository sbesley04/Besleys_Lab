"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { isExternalImage } from "@/lib/images";
import { field, input, primaryButton, ghostButton, dangerButton, errorText } from "../../_components/formStyles";
import styles from "../../_components/accountArea.module.css";
import { DEFAULT_FIELD_NOTES } from "@/lib/fieldNotes";

// Admin manager for the home-page field notebook: add photos (upload or
// path), edit alt/caption/tilt, reorder, delete. When the table is empty the
// current defaults can be imported as a starting point.

interface Note {
  id: string;
  image: string;
  alt: string;
  caption: string;
  tilt: number;
  position: number;
}

interface Draft {
  image: string;
  alt: string;
  caption: string;
  tilt: number;
}

const emptyDraft: Draft = { image: "", alt: "", caption: "", tilt: 0 };

const smallBtn: React.CSSProperties = {
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

export default function FieldNotesManager() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/field-notes");
      if (!res.ok) {
        setError("Couldn't load the notebook entries.");
        return;
      }
      setNotes(await res.json());
      setError(null);
    } catch {
      setError("Couldn't load the notebook entries — check your connection.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function startEdit(note: Note) {
    setEditingId(note.id);
    setDraft({ image: note.image, alt: note.alt, caption: note.caption, tilt: note.tilt });
    setError(null);
    setNotice(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: data });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || "Upload failed.");
      else setDraft((f) => ({ ...f, image: d.url }));
    } catch {
      setError("Upload failed — check your connection.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(editingId ? `/api/field-notes/${editingId}` : "/api/field-notes", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Save failed.");
      } else {
        setNotice(editingId ? "Entry updated." : "Photo added to the notebook.");
        cancelEdit();
        void refresh();
      }
    } catch {
      setError("Save failed — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this photo from the notebook?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/field-notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "The photo could not be removed.");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The photo could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  async function swap(index: number, dir: -1 | 1) {
    if (!notes) return;
    const other = notes[index + dir];
    const note = notes[index];
    if (!other) return;
    setBusy(true);
    setError(null);
    let failure: string | null = null;
    try {
      const first = await fetch(`/api/field-notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move: true, position: other.position }),
      });
      if (!first.ok) throw new Error("The photo order could not be saved.");
      const second = await fetch(`/api/field-notes/${other.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move: true, position: note.position }),
      });
      if (!second.ok) throw new Error("The photo order could not be saved.");
    } catch (e) {
      failure = e instanceof Error ? e.message : "The photo order could not be saved.";
    } finally {
      setBusy(false);
      await refresh();
      if (failure) setError(failure);
    }
  }

  async function seedDefaults() {
    setBusy(true);
    setError(null);
    try {
      for (const d of DEFAULT_FIELD_NOTES) {
        const res = await fetch("/api/field-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: d.image, alt: d.alt, caption: d.caption, tilt: d.tilt }),
        });
        if (!res.ok) throw new Error("Import stopped before every photo was added.");
      }
      setNotice("Imported the current strip — edit away.");
      void refresh();
    } catch {
      setError("Import failed — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (notes === null) {
    return (
      <div className={`paper-card ${styles.statePanel} ${styles.staticCard}`}>
        <p role={error ? "alert" : "status"} style={error ? errorText : { color: "var(--ink-soft)" }}>
          {error ?? "Loading the notebook…"}
        </p>
        {error && (
          <button type="button" style={ghostButton} onClick={() => void refresh()}>
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.manager} aria-busy={busy || uploading}>
      {/* --- Add / edit form --- */}
      <form onSubmit={submit} className={`paper-card ${styles.staticCard}`} style={{ padding: "1.4rem", display: "grid", gap: "1rem" }}>
        <strong style={{ fontSize: "1rem" }}>{editingId ? "Edit entry" : "Add a photo"}</strong>

        <div style={field}>
          <span>Photo *</span>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            {draft.image && (
              <span style={{ position: "relative", width: 72, height: 90, borderRadius: 4, overflow: "hidden", border: "1px solid var(--line)" }}>
                <Image src={draft.image} alt="" fill sizes="72px" unoptimized={isExternalImage(draft.image)} style={{ objectFit: "cover" }} />
              </span>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Upload a field notebook photo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
                e.target.value = "";
              }}
              className={styles.fileInput}
            />
            {uploading && <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>Uploading…</span>}
          </div>
          <input
            style={input}
            value={draft.image}
            onChange={(e) => setDraft((f) => ({ ...f, image: e.target.value }))}
            placeholder="/photos/…  ·  /uploads/…  ·  https://…"
            aria-label="Image path"
            required
          />
          <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>
            Upload a file or point at an existing photo under /photos/.
          </span>
        </div>

        <label style={field}>
          Alt text * <span style={{ fontWeight: 400 }}>(describe the photo for screen readers)</span>
          <input style={input} value={draft.alt} onChange={(e) => setDraft((f) => ({ ...f, alt: e.target.value }))} required />
        </label>

        <label style={field}>
          Caption * <span style={{ fontWeight: 400 }}>(the handwritten line under the print)</span>
          <input style={input} value={draft.caption} onChange={(e) => setDraft((f) => ({ ...f, caption: e.target.value }))} maxLength={60} required />
        </label>

        <label style={field}>
          Tilt — {draft.tilt}°
          <input
            type="range"
            min={-4}
            max={4}
            step={0.5}
            value={draft.tilt}
            onChange={(e) => setDraft((f) => ({ ...f, tilt: Number(e.target.value) }))}
            className={styles.rangeControl}
            style={{ maxWidth: 260 }}
          />
        </label>

        {error && (
          <p role="alert" style={{ ...errorText, fontSize: "0.9rem", margin: 0 }}>
            {error}
          </p>
        )}
        {notice && (
          <p role="status" style={{ color: "var(--ink-soft)", fontSize: "0.9rem", margin: 0 }}>
            {notice}
          </p>
        )}

        <div className={styles.formActions}>
          <button type="submit" style={primaryButton} disabled={busy || uploading}>
            {busy ? "Saving…" : editingId ? "Save changes" : "Add to notebook"}
          </button>
          {editingId && (
            <button type="button" style={ghostButton} onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* --- Current entries --- */}
      {notes.length === 0 ? (
        <div className={`paper-card ${styles.staticCard}`} style={{ padding: "1.75rem", textAlign: "center" }}>
          <p style={{ margin: "0 0 1rem", color: "var(--ink-soft)" }}>
            No entries yet — the home page is showing the built-in defaults. Import them to start
            editing, or add photos above.
          </p>
          <button type="button" style={ghostButton} onClick={seedDefaults} disabled={busy}>
            Import the current strip
          </button>
        </div>
      ) : (
        <ul className={styles.recordList}>
          {notes.map((n, i) => (
            <li
              key={n.id}
              className={`paper-card ${styles.noteRow} ${styles.staticCard}`}
            >
              <span style={{ position: "relative", width: 56, height: 70, borderRadius: 4, overflow: "hidden", border: "1px solid var(--line)", flex: "none" }}>
                <Image src={n.image} alt="" fill sizes="56px" unoptimized={isExternalImage(n.image)} style={{ objectFit: "cover" }} />
              </span>
              <div className={styles.breakable}>
                <div style={{ fontFamily: "var(--font-hand)", fontSize: "1.15rem" }}>{n.caption}</div>
                <div style={{ color: "var(--ink-soft)", fontSize: "0.8rem" }}>{n.alt}</div>
              </div>
              <div className={styles.noteActions}>
                <button type="button" className={styles.smallButton} style={smallBtn} disabled={busy || i === 0} onClick={() => swap(i, -1)} aria-label={`Move "${n.caption}" earlier`}>
                  ←
                </button>
                <button type="button" className={styles.smallButton} style={smallBtn} disabled={busy || i === notes.length - 1} onClick={() => swap(i, 1)} aria-label={`Move "${n.caption}" later`}>
                  →
                </button>
                <button type="button" className={styles.smallButton} style={smallBtn} disabled={busy} onClick={() => startEdit(n)}>
                  Edit
                </button>
                <button type="button" className={styles.smallButton} style={{ ...dangerButton, padding: "0.3rem 0.6rem", fontSize: "0.85rem" }} disabled={busy} onClick={() => remove(n.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

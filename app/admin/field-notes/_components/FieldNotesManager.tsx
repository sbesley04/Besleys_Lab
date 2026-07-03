"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { field, input, primaryButton, ghostButton, dangerButton } from "../../_components/formStyles";
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
    try {
      await fetch(`/api/field-notes/${id}`, { method: "DELETE" });
      void refresh();
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
    try {
      await fetch(`/api/field-notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move: true, position: other.position }),
      });
      await fetch(`/api/field-notes/${other.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move: true, position: note.position }),
      });
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function seedDefaults() {
    setBusy(true);
    setError(null);
    try {
      for (const d of DEFAULT_FIELD_NOTES) {
        await fetch("/api/field-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: d.image, alt: d.alt, caption: d.caption, tilt: d.tilt }),
        });
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
    return <p style={{ color: "var(--ink-soft)" }}>{error ?? "Loading…"}</p>;
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* --- Add / edit form --- */}
      <form onSubmit={submit} className="paper-card" style={{ padding: "1.4rem", display: "grid", gap: "1rem" }}>
        <strong style={{ fontSize: "1rem" }}>{editingId ? "Edit entry" : "Add a photo"}</strong>

        <div style={field}>
          Photo *
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            {draft.image && (
              <span style={{ position: "relative", width: 72, height: 90, borderRadius: 4, overflow: "hidden", border: "1px solid var(--line)" }}>
                <Image src={draft.image} alt="preview" fill sizes="72px" style={{ objectFit: "cover" }} />
              </span>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
                e.target.value = "";
              }}
              style={{ fontSize: "0.85rem" }}
            />
            {uploading && <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>Uploading…</span>}
          </div>
          <input
            style={input}
            value={draft.image}
            onChange={(e) => setDraft((f) => ({ ...f, image: e.target.value }))}
            placeholder="/photos/…  ·  /uploads/…  ·  https://…"
            aria-label="Image path"
          />
          <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>
            Upload a file or point at an existing photo under /photos/.
          </span>
        </div>

        <label style={field}>
          Alt text * <span style={{ fontWeight: 400 }}>(describe the photo for screen readers)</span>
          <input style={input} value={draft.alt} onChange={(e) => setDraft((f) => ({ ...f, alt: e.target.value }))} />
        </label>

        <label style={field}>
          Caption * <span style={{ fontWeight: 400 }}>(the handwritten line under the print)</span>
          <input style={input} value={draft.caption} onChange={(e) => setDraft((f) => ({ ...f, caption: e.target.value }))} maxLength={60} />
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
            style={{ accentColor: "var(--accent)", maxWidth: 260 }}
          />
        </label>

        {error && (
          <p role="alert" style={{ color: "#9b3a2f", fontSize: "0.9rem", margin: 0 }}>
            {error}
          </p>
        )}
        {notice && (
          <p role="status" style={{ color: "var(--ink-soft)", fontSize: "0.9rem", margin: 0 }}>
            {notice}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem" }}>
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
        <div className="paper-card" style={{ padding: "1.75rem", textAlign: "center" }}>
          <p style={{ margin: "0 0 1rem", color: "var(--ink-soft)" }}>
            No entries yet — the home page is showing the built-in defaults. Import them to start
            editing, or add photos above.
          </p>
          <button type="button" style={ghostButton} onClick={seedDefaults} disabled={busy}>
            Import the current strip
          </button>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.75rem" }}>
          {notes.map((n, i) => (
            <li
              key={n.id}
              className="paper-card"
              style={{ padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}
            >
              <span style={{ position: "relative", width: 56, height: 70, borderRadius: 4, overflow: "hidden", border: "1px solid var(--line)", flex: "none" }}>
                <Image src={n.image} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
              </span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontFamily: "var(--font-hand)", fontSize: "1.15rem" }}>{n.caption}</div>
                <div style={{ color: "var(--ink-soft)", fontSize: "0.8rem" }}>{n.alt}</div>
              </div>
              <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                <button type="button" style={smallBtn} disabled={busy || i === 0} onClick={() => swap(i, -1)} aria-label={`Move "${n.caption}" earlier`}>
                  ←
                </button>
                <button type="button" style={smallBtn} disabled={busy || i === notes.length - 1} onClick={() => swap(i, 1)} aria-label={`Move "${n.caption}" later`}>
                  →
                </button>
                <button type="button" style={smallBtn} disabled={busy} onClick={() => startEdit(n)}>
                  Edit
                </button>
                <button type="button" style={{ ...dangerButton, padding: "0.3rem 0.6rem", fontSize: "0.85rem" }} disabled={busy} onClick={() => remove(n.id)}>
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

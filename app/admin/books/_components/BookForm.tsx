"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { field, input, textarea, primaryButton, ghostButton, dangerButton } from "../../_components/formStyles";
import { Spine } from "@/app/library/_components/BookSpine";
import {
  BOOK_DESIGNS,
  BOOK_DESIGN_LABELS,
  SPINE_HEIGHT,
  SPINE_THICKNESS,
  MAX_SHELVES,
  MAX_BOOKCASES,
  bookProblems,
  type BookDesign,
} from "@/lib/library";

// Create/edit form for a library book, with a live spine preview that updates
// as you tune size, color, and design. Talks to /api/books[/:id].

export interface BookInputForm {
  id?: string;
  title: string;
  author: string;
  slug: string;
  review: string;
  rating: number;
  color: string;
  height: number;
  thickness: number;
  design: string;
  bookcase: number;
  shelf: number;
  published: boolean;
}

const empty: BookInputForm = {
  title: "",
  author: "",
  slug: "",
  review: "",
  rating: 0,
  color: "#7a6a52",
  height: SPINE_HEIGHT.default,
  thickness: SPINE_THICKNESS.default,
  design: "plain",
  bookcase: 0,
  shelf: 0,
  published: true,
};

export default function BookForm({ book }: { book?: BookInputForm }) {
  const router = useRouter();
  const isEdit = Boolean(book?.id);
  const [form, setForm] = useState<BookInputForm>(book ?? empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof BookInputForm>(key: K, value: BookInputForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      ...form,
      rating: form.rating || null,
    };
    const problems = bookProblems(payload);
    if (problems.length) {
      setError(problems.join(" "));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/books/${book!.id}` : "/api/books", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong — the book was not saved.");
        return;
      }
      router.push("/admin/books");
      router.refresh();
    } catch {
      setError("Network error — the book was not saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!book?.id || !confirm("Remove this book and all its reader reviews?")) return;
    await fetch(`/api/books/${book.id}`, { method: "DELETE" }).catch(() => null);
    router.push("/admin/books");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: "1.5rem 2rem",
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem", minWidth: 0 }}>
        <label style={field}>
          Title *
          <input style={input} value={form.title} onChange={(e) => set("title", e.target.value)} />
        </label>

        <label style={field}>
          Author *
          <input style={input} value={form.author} onChange={(e) => set("author", e.target.value)} />
        </label>

        <label style={field}>
          Slug <span style={{ fontWeight: 400 }}>(optional — generated from title + author)</span>
          <input style={input} value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="the-book-title" />
        </label>

        {/* --- Spine design --- */}
        <fieldset style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "1rem 1.1rem", display: "grid", gap: "0.9rem" }}>
          <legend style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink-soft)", padding: "0 0.4rem" }}>
            Spine design
          </legend>

          <label style={{ ...field, flexDirection: "row", alignItems: "center", gap: "0.75rem" }}>
            Color
            <input
              type="color"
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
              aria-label="Spine color"
              style={{ width: 48, height: 32, padding: 2, border: "1px solid var(--line)", borderRadius: 4, background: "var(--paper)", cursor: "pointer" }}
            />
            <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>{form.color}</span>
          </label>

          <label style={field}>
            Height — {form.height}px
            <input
              type="range"
              min={SPINE_HEIGHT.min}
              max={SPINE_HEIGHT.max}
              value={form.height}
              onChange={(e) => set("height", Number(e.target.value))}
              style={{ accentColor: "var(--accent)" }}
            />
          </label>

          <label style={field}>
            Thickness — {form.thickness}px
            <input
              type="range"
              min={SPINE_THICKNESS.min}
              max={SPINE_THICKNESS.max}
              value={form.thickness}
              onChange={(e) => set("thickness", Number(e.target.value))}
              style={{ accentColor: "var(--accent)" }}
            />
          </label>

          <label style={field}>
            Design
            <select style={{ ...input, width: "auto" }} value={form.design} onChange={(e) => set("design", e.target.value)}>
              {BOOK_DESIGNS.map((d) => (
                <option key={d} value={d}>
                  {BOOK_DESIGN_LABELS[d as BookDesign]}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
            <label style={field}>
              Bookcase
              <select
                style={{ ...input, width: "auto" }}
                value={form.bookcase}
                onChange={(e) => set("bookcase", Number(e.target.value))}
              >
                {Array.from({ length: MAX_BOOKCASES }, (_, i) => (
                  <option key={i} value={i}>
                    Bookcase {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label style={field}>
              Shelf
              <select
                style={{ ...input, width: "auto" }}
                value={form.shelf}
                onChange={(e) => set("shelf", Number(e.target.value))}
              >
                {Array.from({ length: MAX_SHELVES }, (_, i) => (
                  <option key={i} value={i}>
                    Shelf {i + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <label style={field}>
          My rating
          <select style={{ ...input, width: "auto" }} value={form.rating} onChange={(e) => set("rating", Number(e.target.value))}>
            <option value={0}>No rating</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)}
              </option>
            ))}
          </select>
        </label>

        <label style={field}>
          Review <span style={{ fontWeight: 400 }}>(Markdown — shown on the book&rsquo;s page)</span>
          <textarea
            style={textarea}
            value={form.review}
            onChange={(e) => set("review", e.target.value)}
            placeholder={"What stuck with you? A few paragraphs is plenty."}
          />
        </label>

        <label style={{ ...field, flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} />
          On the shelf <span style={{ fontWeight: 400 }}>(visible to visitors)</span>
        </label>

        {error && (
          <p role="alert" style={{ color: "#9b3a2f", fontSize: "0.9rem", margin: 0 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" style={primaryButton} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add to shelf"}
          </button>
          <button type="button" style={ghostButton} onClick={() => router.push("/admin/books")}>
            Cancel
          </button>
          {isEdit && (
            <button type="button" style={{ ...dangerButton, marginLeft: "auto" }} onClick={handleDelete}>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* --- Live preview --- */}
      <div style={{ position: "sticky", top: "5rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", margin: "0 0 0.75rem" }}>Preview</p>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "1rem 1.5rem 0",
            background: "linear-gradient(90deg, #5d4a35, #4c3c2b 50%, #5d4a35)",
            borderRadius: "6px 6px 0 0",
            minHeight: 250,
          }}
        >
          <Spine
            book={{
              slug: "preview",
              title: form.title || "Untitled",
              author: form.author || "Author",
              color: form.color,
              height: form.height,
              thickness: form.thickness,
              design: form.design,
            }}
          />
        </div>
        <div
          style={{
            height: 12,
            background: "linear-gradient(180deg, #96795a, #5d4a35)",
            borderRadius: "0 0 4px 4px",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
          }}
        />
      </div>
    </form>
  );
}

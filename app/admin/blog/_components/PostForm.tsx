"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import { field, input, textarea, primaryButton, ghostButton, dangerButton } from "../../_components/formStyles";

// Create/edit form for blog posts with a write/preview toggle, slug preview,
// inline validation, and an explicit draft/publish choice. Talks to
// /api/posts[/:id].

export interface PostInput {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImage: string;
  published: boolean;
}

const empty: PostInput = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  coverImage: "",
  published: false,
};

// Mirrors lib/slug.ts so the editor can show the URL before saving.
function slugPreview(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function PostForm({ post }: { post?: PostInput }) {
  const router = useRouter();
  const isEdit = Boolean(post?.id);
  const [form, setForm] = useState<PostInput>(post ?? empty);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; body?: string }>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");

  function set<K extends keyof PostInput>(key: K, value: PostInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const previewHtml = useMemo(
    () => (tab === "preview" ? (marked.parse(form.body || "*Nothing to preview yet.*", { async: false }) as string) : ""),
    [tab, form.body],
  );

  const urlSlug = form.slug.trim() ? slugPreview(form.slug) : slugPreview(form.title);

  async function submit(publish: boolean) {
    setError(null);
    const fe: typeof fieldErrors = {};
    if (!form.title.trim()) fe.title = "A title is required.";
    if (!form.body.trim()) fe.body = "The post needs a body.";
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;

    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/posts/${post!.id}` : "/api/posts", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, published: publish }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong — the post was not saved.");
        return;
      }
      router.push("/admin/blog");
      router.refresh();
    } catch {
      setError("Network error — the post was not saved. Your text is still here; try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!post?.id || !confirm("Delete this post? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Delete failed — try again.");
        return;
      }
      router.push("/admin/blog");
      router.refresh();
    } catch {
      setError("Network error — the post was not deleted.");
    }
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    ...ghostButton,
    padding: "0.4rem 0.9rem",
    fontWeight: active ? 600 : 400,
    color: active ? "var(--ink)" : "var(--ink-soft)",
    borderColor: active ? "var(--accent)" : "var(--line)",
    background: active ? "var(--paper)" : "transparent",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(form.published);
      }}
      style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
    >
      <label style={field}>
        Title *
        <input
          style={{ ...input, ...(fieldErrors.title ? { borderColor: "#9b3a2f" } : {}) }}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="What's the post about?"
          aria-invalid={Boolean(fieldErrors.title)}
        />
        {fieldErrors.title && (
          <span role="alert" style={{ color: "#9b3a2f", fontWeight: 400 }}>
            {fieldErrors.title}
          </span>
        )}
      </label>

      <label style={field}>
        Slug <span style={{ fontWeight: 400 }}>(optional — generated from the title)</span>
        <input
          style={input}
          value={form.slug}
          onChange={(e) => set("slug", e.target.value)}
          placeholder="my-post-title"
        />
        <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>
          URL: /blog/{urlSlug || "…"}
        </span>
      </label>

      <label style={field}>
        Excerpt <span style={{ fontWeight: 400 }}>(one line shown in the blog index — {form.excerpt.length}/160)</span>
        <input
          style={input}
          value={form.excerpt}
          maxLength={160}
          onChange={(e) => set("excerpt", e.target.value)}
          placeholder="A one-sentence hook for the list page."
        />
      </label>

      <label style={field}>
        Cover image URL <span style={{ fontWeight: 400 }}>(optional)</span>
        <input
          style={input}
          value={form.coverImage}
          onChange={(e) => set("coverImage", e.target.value)}
          placeholder="/photos/…  ·  /uploads/…  ·  https://…"
        />
      </label>

      <div style={field}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <span>Body * <span style={{ fontWeight: 400 }}>(Markdown)</span></span>
          <div style={{ display: "flex", gap: "0.4rem" }} role="tablist" aria-label="Editor mode">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "write"}
              style={tabBtn(tab === "write")}
              onClick={() => setTab("write")}
            >
              Write
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "preview"}
              style={tabBtn(tab === "preview")}
              onClick={() => setTab("preview")}
            >
              Preview
            </button>
          </div>
        </div>

        {tab === "write" ? (
          <textarea
            style={{ ...textarea, ...(fieldErrors.body ? { borderColor: "#9b3a2f" } : {}) }}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder={"## Heading\n\nWrite in markdown — **bold**, *italics*, code blocks, lists, links…"}
            aria-invalid={Boolean(fieldErrors.body)}
          />
        ) : (
          <div
            className="paper-card prose"
            style={{ padding: "1rem 1.25rem", minHeight: 240, background: "var(--paper)" }}
            // Safe here: preview of the author's own markdown, same rendering
            // path as the public post page.
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
        {fieldErrors.body && (
          <span role="alert" style={{ color: "#9b3a2f", fontWeight: 400 }}>
            {fieldErrors.body}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" style={{ color: "#9b3a2f", fontSize: "0.9rem", margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <button
          type="button"
          style={primaryButton}
          disabled={saving}
          onClick={() => void submit(true)}
        >
          {saving ? "Saving…" : form.published ? "Save & keep published" : "Publish"}
        </button>
        <button
          type="button"
          style={ghostButton}
          disabled={saving}
          onClick={() => void submit(false)}
        >
          {form.published ? "Unpublish to draft" : "Save draft"}
        </button>
        <button type="button" style={ghostButton} onClick={() => router.push("/admin/blog")}>
          Cancel
        </button>
        {isEdit && (
          <button type="button" style={{ ...dangerButton, marginLeft: "auto" }} onClick={handleDelete}>
            Delete
          </button>
        )}
      </div>
      <p style={{ color: "var(--ink-soft)", fontSize: "0.82rem", margin: 0 }}>
        Drafts are only visible in the admin area. Publishing sets the public date the first time.
      </p>
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";
import {
  field,
  input,
  textarea,
  primaryButton,
  ghostButton,
  dangerButton,
  errorText,
  invalidControl,
} from "../../_components/formStyles";
import styles from "../../_components/accountArea.module.css";

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
    () => (tab === "preview" ? renderMarkdown(form.body || "*Nothing to preview yet.*") : ""),
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
    setSaving(true);
    setError(null);
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
    } finally {
      setSaving(false);
    }
  }

  function handleTabKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "ArrowLeft" || event.key === "Home" ? "write" : "preview";
    setTab(next);
    document.getElementById(`post-${next}-tab`)?.focus();
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
      className={styles.form}
      aria-busy={saving}
    >
      <label style={field}>
        Title *
        <input
          style={{ ...input, ...(fieldErrors.title ? invalidControl : {}) }}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="What's the post about?"
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? "post-title-error" : undefined}
          required
        />
        {fieldErrors.title && (
          <span id="post-title-error" role="alert" style={{ ...errorText, fontWeight: 400 }}>
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
        <div className={styles.editorLabelRow}>
          <label htmlFor="post-body">Body * <span style={{ fontWeight: 400 }}>(Markdown)</span></label>
          <div className={styles.tabList} role="tablist" aria-label="Editor mode" onKeyDown={handleTabKey}>
            <button
              type="button"
              role="tab"
              id="post-write-tab"
              aria-controls="post-write-panel"
              aria-selected={tab === "write"}
              tabIndex={tab === "write" ? 0 : -1}
              style={tabBtn(tab === "write")}
              onClick={() => setTab("write")}
            >
              Write
            </button>
            <button
              type="button"
              role="tab"
              id="post-preview-tab"
              aria-controls="post-preview-panel"
              aria-selected={tab === "preview"}
              tabIndex={tab === "preview" ? 0 : -1}
              style={tabBtn(tab === "preview")}
              onClick={() => setTab("preview")}
            >
              Preview
            </button>
          </div>
        </div>

        <div
          id="post-write-panel"
          role="tabpanel"
          aria-labelledby="post-write-tab"
          hidden={tab !== "write"}
        >
          <textarea
            id="post-body"
            style={{ ...textarea, ...(fieldErrors.body ? invalidControl : {}) }}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder={"## Heading\n\nWrite in markdown — **bold**, *italics*, code blocks, lists, links…"}
            aria-invalid={Boolean(fieldErrors.body)}
            aria-describedby={fieldErrors.body ? "post-body-error" : undefined}
            aria-required="true"
          />
        </div>
        <div
          id="post-preview-panel"
          role="tabpanel"
          aria-labelledby="post-preview-tab"
          hidden={tab !== "preview"}
          className={`paper-card prose ${styles.previewPanel} ${styles.staticCard}`}
          // Safe here: preview of the author's own markdown, same rendering
          // path as the public post page.
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
        {fieldErrors.body && (
          <span id="post-body-error" role="alert" style={{ ...errorText, fontWeight: 400 }}>
            {fieldErrors.body}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" style={{ ...errorText, fontSize: "0.9rem", margin: 0 }}>
          {error}
        </p>
      )}

      <div className={styles.formActions}>
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
        <button type="button" style={ghostButton} disabled={saving} onClick={() => router.push("/admin/blog")}>
          Cancel
        </button>
        {isEdit && (
          <button type="button" className={styles.dangerPush} style={dangerButton} disabled={saving} onClick={handleDelete}>
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

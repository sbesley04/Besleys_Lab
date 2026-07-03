"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { field, input, textarea, primaryButton, ghostButton, dangerButton } from "../../_components/formStyles";

// Shared create/edit form for projects, with inline thumbnail upload that posts
// to /api/upload and stores the returned URL.
export interface ProjectInput {
  id?: string;
  title: string;
  slug: string;
  description: string;
  techStack: string; // comma-separated in the UI; the API splits it
  githubUrl: string;
  thumbnail: string;
  published: boolean;
}

const empty: ProjectInput = {
  title: "",
  slug: "",
  description: "",
  techStack: "",
  githubUrl: "",
  thumbnail: "",
  published: false,
};

export default function ProjectForm({ project }: { project?: ProjectInput }) {
  const router = useRouter();
  const isEdit = Boolean(project?.id);
  const [form, setForm] = useState<ProjectInput>(project ?? empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    const data = new FormData();
    data.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: data });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Upload failed.");
      return;
    }
    const { url } = await res.json();
    set("thumbnail", url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch(isEdit ? `/api/projects/${project!.id}` : "/api/projects", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Something went wrong.");
      return;
    }
    router.push("/admin/projects");
    router.refresh();
  }

  async function handleDelete() {
    if (!project?.id || !confirm("Delete this project?")) return;
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    router.push("/admin/projects");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <label style={field}>
        Title
        <input style={input} value={form.title} onChange={(e) => set("title", e.target.value)} required />
      </label>

      <label style={field}>
        Slug <span style={{ fontWeight: 400 }}>(optional)</span>
        <input style={input} value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="my-project" />
      </label>

      <label style={field}>
        Description
        <textarea
          style={{ ...textarea, minHeight: 120, fontFamily: "var(--font-body)" }}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          required
        />
      </label>

      <label style={field}>
        Tech stack <span style={{ fontWeight: 400 }}>(comma-separated)</span>
        <input
          style={input}
          value={form.techStack}
          onChange={(e) => set("techStack", e.target.value)}
          placeholder="Next.js, Prisma, Python"
        />
      </label>

      <label style={field}>
        GitHub URL
        <input
          style={input}
          value={form.githubUrl}
          onChange={(e) => set("githubUrl", e.target.value)}
          placeholder="https://github.com/…"
        />
      </label>

      <div style={field}>
        Thumbnail
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          {form.thumbnail && (
            <Image
              src={form.thumbnail}
              alt="thumbnail preview"
              width={96}
              height={64}
              style={{ objectFit: "cover", borderRadius: 4, border: "1px solid var(--line)" }}
            />
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
            style={{ fontSize: "0.85rem" }}
          />
          {uploading && <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>Uploading…</span>}
        </div>
        <input
          style={{ ...input, marginTop: "0.5rem" }}
          value={form.thumbnail}
          onChange={(e) => set("thumbnail", e.target.value)}
          placeholder="/uploads/…  or paste a URL"
        />
      </div>

      <label style={{ ...field, flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
        <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} />
        Published <span style={{ fontWeight: 400 }}>(visible to visitors)</span>
      </label>

      {error && (
        <p role="alert" style={{ color: "#9b3a2f", fontSize: "0.9rem", margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button type="submit" style={primaryButton} disabled={saving || uploading}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create project"}
        </button>
        <button type="button" style={ghostButton} onClick={() => router.push("/admin/projects")}>
          Cancel
        </button>
        {isEdit && (
          <button type="button" style={{ ...dangerButton, marginLeft: "auto" }} onClick={handleDelete}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

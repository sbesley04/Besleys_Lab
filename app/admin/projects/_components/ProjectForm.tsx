"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { isExternalImage } from "@/lib/images";
import { field, input, textarea, primaryButton, ghostButton, dangerButton, errorText } from "../../_components/formStyles";
import styles from "../../_components/accountArea.module.css";

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
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: data });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Upload failed.");
        return;
      }
      const { url } = await res.json();
      set("thumbnail", url);
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(isEdit ? `/api/projects/${project!.id}` : "/api/projects", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Something went wrong — the project was not saved.");
        return;
      }
      router.push("/admin/projects");
      router.refresh();
    } catch {
      setError("Network error — the project was not saved. Your changes are still here.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project?.id || !confirm("Delete this project?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "The project could not be deleted.");
        return;
      }
      router.push("/admin/projects");
      router.refresh();
    } catch {
      setError("Network error — the project was not deleted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} aria-busy={saving || uploading}>
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
          inputMode="url"
        />
      </label>

      <div style={field}>
        <span>Thumbnail</span>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          {form.thumbnail && (
            <Image
              src={form.thumbnail}
              alt="thumbnail preview"
              width={96}
              height={64}
              unoptimized={isExternalImage(form.thumbnail)}
              style={{ objectFit: "cover", borderRadius: 4, border: "1px solid var(--line)" }}
            />
          )}
          <input
            id="project-thumbnail-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = "";
            }}
            className={styles.fileInput}
            aria-label="Upload a project thumbnail"
          />
          {uploading && <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>Uploading…</span>}
        </div>
        <input
          style={{ ...input, marginTop: "0.5rem" }}
          value={form.thumbnail}
          onChange={(e) => set("thumbnail", e.target.value)}
          placeholder="/uploads/…  or paste a URL"
          aria-label="Thumbnail image path or URL"
        />
      </div>

      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} />
        Published <span style={{ fontWeight: 400 }}>(visible to visitors)</span>
      </label>

      {error && (
        <p role="alert" style={{ ...errorText, fontSize: "0.9rem", margin: 0 }}>
          {error}
        </p>
      )}

      <div className={styles.formActions}>
        <button type="submit" style={primaryButton} disabled={saving || uploading}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create project"}
        </button>
        <button type="button" style={ghostButton} disabled={saving} onClick={() => router.push("/admin/projects")}>
          Cancel
        </button>
        {isEdit && (
          <button type="button" className={styles.dangerPush} style={dangerButton} disabled={saving || uploading} onClick={handleDelete}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

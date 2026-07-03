import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canEditContent } from "@/lib/validation";
import ProjectForm from "../_components/ProjectForm";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const session = await requireStaff();
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  // Editors can only open their own projects; treat others as not found.
  if (!canEditContent(session.user.role, session.user.id, project.authorId)) notFound();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/admin/projects" style={{ fontSize: "0.9rem" }}>
        ← Projects
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.5rem 0 1.5rem" }}>
        Edit project
      </h1>
      <ProjectForm
        project={{
          id: project.id,
          title: project.title,
          slug: project.slug,
          description: project.description,
          techStack: project.techStack, // already comma-separated in SQLite
          githubUrl: project.githubUrl ?? "",
          thumbnail: project.thumbnail ?? "",
          published: project.published,
        }}
      />
    </main>
  );
}

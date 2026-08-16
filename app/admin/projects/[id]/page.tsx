import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canEditContent } from "@/lib/validation";
import ProjectForm from "../_components/ProjectForm";
import styles from "../../_components/accountArea.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit project — Admin" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();
  // Editors can only open their own projects; treat others as not found.
  if (!canEditContent(session.user.role, session.user.id, project.authorId)) notFound();

  return (
    <main className={`${styles.page} ${styles.pageEditor} ${styles.accountPage}`}>
      <Link href="/admin/projects" className={styles.backLink}>
        ← Projects
      </Link>
      <h1 className={`${styles.pageTitle} ${styles.pageTitleAfterBack}`}>
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

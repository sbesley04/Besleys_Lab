import Link from "next/link";
import { requireStaff } from "@/lib/session";
import ProjectForm from "../_components/ProjectForm";

export default async function NewProjectPage() {
  await requireStaff();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/admin/projects" style={{ fontSize: "0.9rem" }}>
        ← Projects
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.5rem 0 1.5rem" }}>
        New project
      </h1>
      <ProjectForm />
    </main>
  );
}

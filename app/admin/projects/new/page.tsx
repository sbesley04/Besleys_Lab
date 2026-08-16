import Link from "next/link";
import { requireStaff } from "@/lib/session";
import ProjectForm from "../_components/ProjectForm";
import styles from "../../_components/accountArea.module.css";

export const metadata = { title: "New project — Admin" };

export default async function NewProjectPage() {
  await requireStaff();

  return (
    <main className={`${styles.page} ${styles.pageEditor} ${styles.accountPage}`}>
      <Link href="/admin/projects" className={styles.backLink}>
        ← Projects
      </Link>
      <h1 className={`${styles.pageTitle} ${styles.pageTitleAfterBack}`}>
        New project
      </h1>
      <ProjectForm />
    </main>
  );
}

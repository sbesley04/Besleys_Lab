import Link from "next/link";
import styles from "../lab.module.css";

// Shared chrome for a demo page: back link, title, the one-line takeaway, and
// the demo itself. Mirrors app/games/_components/GameFrame.
export default function LabFrame({
  title,
  takeaway,
  children,
}: {
  title: string;
  takeaway: string;
  children: React.ReactNode;
}) {
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <Link href="/lab" className={styles.backLink}>
          ← All labs
        </Link>
        <p className={styles.eyebrow}>Interactive notebook</p>
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.aside}>{takeaway}</p>
      </header>
      {children}
    </main>
  );
}

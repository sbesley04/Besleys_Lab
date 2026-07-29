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
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/lab" style={{ fontSize: "0.9rem" }}>
        ← Lab
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0.5rem 0 0.35rem" }}>
        {title}
      </h1>
      <p className={styles.aside} style={{ marginBottom: "1.6rem" }}>
        {takeaway}
      </p>
      {children}
    </main>
  );
}

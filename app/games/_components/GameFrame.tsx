import Link from "next/link";
import styles from "./gameFrame.module.css";

// Shared chrome for a single game page: a back link to the arcade and the
// title, with the game itself as children. Keeps every game page consistent
// and makes new ones trivial to add.
export default function GameFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className={styles.frame}>
      <header className={styles.header}>
        <nav aria-label="Breadcrumb">
          <Link href="/games" className={styles.backLink}>
            ← Arcade
          </Link>
        </nav>
        <span className={styles.kicker}>Playable experiment</span>
        <h1 className={styles.title}>{title}</h1>
      </header>
      <div className={styles.content}>{children}</div>
    </main>
  );
}

import Link from "next/link";
import NextPrev from "@/app/_components/NextPrev";
import { demos } from "../registry";
import styles from "../lab.module.css";

// Shared chrome for a demo page: back link, title, the one-line takeaway, and
// the demo itself. Mirrors app/games/_components/GameFrame.
export default function LabFrame({
  slug,
  title,
  takeaway,
  children,
}: {
  slug: string;
  title: string;
  takeaway: string;
  children: React.ReactNode;
}) {
  const index = demos.findIndex((demo) => demo.slug === slug);
  const destination = (offset: number) => {
    const demo = demos[(index + offset + demos.length) % demos.length];
    return { href: `/lab/${demo.slug}`, title: demo.title };
  };
  const related = slug === "gradient-descent"
    ? { href: "/games/loss-surface-golf", title: "Play Loss-Surface Golf" }
    : slug === "bayes"
      ? { href: "/games/bayesian-detective", title: "Play Bayesian Detective" }
      : undefined;
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
      {index >= 0 && <NextPrev previous={destination(-1)} next={destination(1)} crossLink={related} label="Explore more labs" />}
    </main>
  );
}

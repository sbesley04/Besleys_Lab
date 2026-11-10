import Link from "next/link";
import styles from "./nextPrev.module.css";

type Destination = { href: string; title: string };

export default function NextPrev({ previous, next, crossLink, label = "Keep exploring" }: {
  previous?: Destination;
  next?: Destination;
  crossLink?: Destination;
  label?: string;
}) {
  return (
    <nav className={styles.explore} aria-label={label}>
      {(previous || next) && (
        <div className={styles.row}>
          {previous ? (
            <Link href={previous.href} className={styles.link} rel="prev">
              <span className={styles.direction}>← Previous</span>
              <span>{previous.title}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={next.href} className={`${styles.link} ${styles.next}`} rel="next">
              <span className={styles.direction}>Next →</span>
              <span>{next.title}</span>
            </Link>
          ) : <span />}
        </div>
      )}
      {crossLink && <Link href={crossLink.href} className={styles.crossLink}>{crossLink.title} →</Link>}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { primaryButton, ghostButton } from "./_components/formStyles";
import styles from "./_components/accountArea.module.css";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={`${styles.page} ${styles.pageWide}`}>
      <section className={`paper-card ${styles.statePanel} ${styles.staticCard}`} role="alert">
        <h1 className={styles.pageTitle}>The admin notebook wouldn&rsquo;t open</h1>
        <p className={styles.subtle}>
          Nothing was changed. Try loading this section again, or return to the dashboard.
        </p>
        {error.digest && <small className={styles.subtle}>Reference: {error.digest}</small>}
        <div className={styles.formActions}>
          <button type="button" style={primaryButton} onClick={reset}>Try again</button>
          <Link href="/admin" className={styles.primaryLink} style={ghostButton}>Admin dashboard</Link>
        </div>
      </section>
    </main>
  );
}

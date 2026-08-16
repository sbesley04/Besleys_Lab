"use client";

import Link from "next/link";
import { primaryButton, ghostButton } from "../admin/_components/formStyles";
import styles from "../admin/_components/accountArea.module.css";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={`${styles.page} ${styles.pageDashboard}`}>
      <section className={`paper-card ${styles.statePanel} ${styles.staticCard}`} role="alert">
        <h1 className={styles.pageTitle}>Your dashboard couldn&rsquo;t be loaded</h1>
        <p className={styles.subtle}>Your saved work is still safe. Try the request again in a moment.</p>
        {error.digest && <small className={styles.subtle}>Reference: {error.digest}</small>}
        <div className={styles.formActions}>
          <button type="button" style={primaryButton} onClick={reset}>Try again</button>
          <Link href="/" className={styles.primaryLink} style={ghostButton}>Return home</Link>
        </div>
      </section>
    </main>
  );
}

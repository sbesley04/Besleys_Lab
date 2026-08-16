import styles from "./_components/accountArea.module.css";

export default function AdminLoading() {
  return (
    <main className={`${styles.page} ${styles.pageWide}`} aria-busy="true" aria-live="polite">
      <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <p className={styles.subtle}>Opening the admin notebook…</p>
      <div className={styles.dashboardGrid} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={`paper-card ${styles.skeleton} ${styles.skeletonCard} ${styles.staticCard}`} />
        ))}
      </div>
    </main>
  );
}

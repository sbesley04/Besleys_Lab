import styles from "../admin/_components/accountArea.module.css";

export default function ProfileLoading() {
  return (
    <main className={`${styles.page} ${styles.pageDashboard}`} aria-busy="true" aria-live="polite">
      <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <p className={styles.subtle}>Gathering your saved work…</p>
      <div className={styles.dashboardGrid} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={`paper-card ${styles.skeleton} ${styles.skeletonCard} ${styles.staticCard}`} />
        ))}
      </div>
    </main>
  );
}

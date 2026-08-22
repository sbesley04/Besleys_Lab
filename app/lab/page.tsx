import Link from "next/link";
import styles from "./lab.module.css";
import { demos, TOPIC_LABELS, type DemoMeta } from "./registry";

// The experiments bench. Driven entirely by ./registry — to add a demo, add an
// entry there and a folder at app/lab/<slug>/.
export const metadata = {
  title: "Lab",
  description:
    "Interactive machine-learning demos: gradient descent, k-means, SVMs, neural nets, Bayes, and reinforcement learning",
};

const TOPIC_ORDER: DemoMeta["topic"][] = [
  "optimization",
  "models",
  "networks",
  "probability",
  "language",
  "rl",
];

export default function LabPage() {
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <Link href="/" className={styles.backLink}>
          ← Home
        </Link>
        <p className={styles.eyebrow}>Experiments bench</p>
        <h1 className={styles.pageTitle}>The Lab</h1>
        <p className={styles.intro}>
          A few of my favorite concepts from my courses at emory and self study, with an attempt to make them intuitive
          to share with other people learning them!
        </p>
      </header>

      {TOPIC_ORDER.map((topic) => {
        const inTopic = demos.filter((d) => d.topic === topic);
        if (inTopic.length === 0) return null;
        return (
          <section key={topic} className={styles.topicSection} aria-labelledby={`topic-${topic}`}>
            <h2 id={`topic-${topic}`} className={styles.topicLabel}>{TOPIC_LABELS[topic]}</h2>
            <div className={styles.hubGrid}>
              {inTopic.map((d) => (
                <Link key={d.slug} href={`/lab/${d.slug}`} className={`paper-card ${styles.hubCard}`}>
                  <h3 className={styles.hubTitle}>{d.title}</h3>
                  <p className={styles.hubBlurb}>{d.blurb}</p>
                  <p className={styles.hubTakeaway}>{d.takeaway}</p>
                  <span className={styles.hubAction} aria-hidden>Open experiment →</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

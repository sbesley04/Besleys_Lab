import Link from "next/link";
import styles from "./lab.module.css";
import { demos, TOPIC_LABELS, type DemoMeta } from "./registry";

// The experiments bench. Driven entirely by ./registry — to add a demo, add an
// entry there and a folder at app/lab/<slug>/.
export const metadata = {
  title: "Lab",
  description:
    "Interactive machine-learning demos: gradient descent, k-means, SVMs, neural nets, Bayes, and reinforcement learning — all running in your browser.",
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
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/" style={{ fontSize: "0.9rem" }}>
        ← Home
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0.5rem 0 0.5rem" }}>
        The Lab
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "2.25rem", maxWidth: "56ch" }}>
        Machine learning you can poke at. Every demo below runs entirely in your browser — no
        server, no Python, nothing pre-recorded. Drag the points around and watch the math
        respond.
      </p>

      {TOPIC_ORDER.map((topic) => {
        const inTopic = demos.filter((d) => d.topic === topic);
        if (inTopic.length === 0) return null;
        return (
          <section key={topic}>
            <h2 className={styles.topicLabel}>{TOPIC_LABELS[topic]}</h2>
            <div className={styles.hubGrid}>
              {inTopic.map((d) => (
                <Link key={d.slug} href={`/lab/${d.slug}`} className={`paper-card ${styles.hubCard}`}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", margin: 0 }}>
                    {d.title}
                  </h3>
                  <p style={{ color: "var(--ink-soft)", margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                    {d.blurb}
                  </p>
                  <p className={styles.hubTakeaway}>{d.takeaway}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

import Link from "next/link";
import Image from "next/image";
import { isExternalImage } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import { splitTechStack } from "@/lib/techstack";
import { featuredProjects as featured } from "@/lib/featuredProjects";
import styles from "./projects.module.css";

// Projects & lab work. Two layers:
//   1. Featured lab work — curated, code-defined highlights (ML/NLP projects,
//      the simulator, this site). Always present, no database required.
//   2. The shelf — database-driven project cards managed from /admin/projects.
export const metadata = {
  title: "Projects & Lab Work",
  description:
    "Here are some projects I'm proud of, showing off a bit of my work as I've been learning",
};
export const dynamic = "force-dynamic";

export default async function ProjectsIndex() {
  // The DB shelf is additive — if the query fails the page still renders the
  // featured section.
  const projects = await prisma.project
    .findMany({ where: { published: true }, orderBy: { createdAt: "desc" } })
    .catch(() => []);

  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Projects &amp; lab work</h1>
      <p className={styles.intro}>
        Here are some projects I am proud of, showing off a bit of my work as I have been learning. Code lives on{" "}
        <a
          href="https://github.com/sbesley04"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.introLink}
        >
          GitHub<span aria-hidden="true"> ↗</span>
          <span className={styles.srOnly}> (opens in a new tab)</span>
        </a>
        .
      </p>

      {/* --- Featured lab work --- */}
      <section aria-labelledby="featured-work-title">
        <h2 id="featured-work-title" className={styles.sectionHeading}>
          Featured work
        </h2>
        <div className={styles.featuredSection}>
          {featured.map((f) => (
            <article key={f.title} className={`paper-card project-card ${styles.featuredCard}`}>
              <div
                className="project-dossier"
                style={{ "--dossier-accent": f.accent } as React.CSSProperties}
                aria-hidden="true"
              >
                <span>{f.mark}</span>
                <i />
                <i />
                <i />
              </div>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{f.title}</h3>
                <span className={styles.period}>{f.period}</span>
              </div>
              <p className={styles.description}>{f.description}</p>
              <ul className={styles.tagList} aria-label={`Technologies used for ${f.title}`}>
                {f.tech.map((t) => (
                  <li key={t} className={styles.tag}>
                    {t}
                  </li>
                ))}
              </ul>
              {f.links.length > 0 && (
                <div className={styles.actionRow}>
                  {f.links.map((l) =>
                    l.external ? (
                      <a
                        key={l.href}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`project-action ${styles.projectAction}`}
                      >
                        {l.label}<span aria-hidden="true"> ↗</span>
                        <span className={styles.srOnly}> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={`project-action ${styles.projectAction}`}
                      >
                        {l.label} →
                      </Link>
                    ),
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* --- Admin-managed shelf --- */}
      {projects.length > 0 && (
        <section aria-labelledby="project-shelf-title" className={styles.shelfSection}>
          <h2 id="project-shelf-title" className={styles.sectionHeading}>
            From the shelf
          </h2>
          <div className={styles.projectGrid}>
            {projects.map((p) => {
              const tags = splitTechStack(p.techStack);
              return (
                <article
                  key={p.id}
                  className={`paper-card ${styles.shelfCard}`}
                >
                  {p.thumbnail && (
                    <div className={styles.thumbnail}>
                      <Image
                        src={p.thumbnail}
                        alt={`Preview image for ${p.title}`}
                        fill
                        sizes="(max-width: 600px) 100vw, 260px"
                        unoptimized={isExternalImage(p.thumbnail)}
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                  )}
                  <h3 className={styles.shelfTitle}>{p.title}</h3>
                  <p className={styles.shelfDescription}>{p.description}</p>
                  {tags.length > 0 && (
                    <ul className={styles.tagList} aria-label={`Technologies used for ${p.title}`}>
                      {tags.map((tag) => (
                        <li key={tag} className={styles.tag}>
                          {tag}
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.githubUrl && (
                    <a
                      href={p.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.shelfLink}
                    >
                      View on GitHub <span aria-hidden="true">↗</span>
                      <span className={styles.srOnly}> (opens in a new tab)</span>
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

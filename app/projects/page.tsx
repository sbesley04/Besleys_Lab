import Link from "next/link";
import Image from "next/image";
import { isExternalImage } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import { splitTechStack } from "@/lib/techstack";
import styles from "./projects.module.css";

// Projects & lab work. Two layers:
//   1. Featured lab work — curated, code-defined highlights (ML/NLP projects,
//      the simulator, this site). Always present, no database required.
//   2. The shelf — database-driven project cards managed from /admin/projects.
export const metadata = {
  title: "Projects & Lab Work",
  description:
    "Selected data science, machine learning, and full-stack work by Samuel Besley — NLP dashboards, prediction models, simulations, and games.",
};
export const dynamic = "force-dynamic";

interface Featured {
  title: string;
  period: string;
  description: string;
  tech: string[];
  links: { label: string; href: string; external?: boolean }[];
  mark: string;
  accent: string;
}

const featured: Featured[] = [
  {
    title: "EpsTracked — document analysis dashboard",
    period: "Spring 2026 · CS/QTM/LING 329",
    description:
      "Full-stack NLP application for exploring events and entities extracted from the publicly released Epstein document corpus. A Python pipeline classified 2,599 events across 787 document threads and surfaced 515 unique entities; a React/TypeScript multi-view dashboard makes the corpus searchable.",
    tech: ["Python", "Transformers", "NLP", "React", "TypeScript", "Vercel"],
    links: [{ label: "Live app", href: "https://eps-tracked.vercel.app", external: true }],
    mark: "NLP",
    accent: "#64758a",
  },
  {
    title: "NYC Airbnb price prediction",
    period: "Spring 2026 · QTM 347",
    description:
      "Price model over 48,000+ NYC listings combining structured features with NLP signals mined from listing names (luxury keywords, capitalization ratio, word statistics). Benchmarked OLS, Ridge, LASSO, and Random Forest; the text features added real signal beyond location and room type.",
    tech: ["Python", "scikit-learn", "pandas", "Feature engineering"],
    links: [],
    mark: "48K",
    accent: "#9a684d",
  },
  {
    title: "Hunger Games simulator",
    period: "Ongoing lab experiment",
    description:
      "A deterministic, trait-driven arena simulation: procedural biome terrain, weather systems, alliances and betrayals, and a narrative event feed. Started life as a Python prototype; now a TypeScript engine you can play right here — bring your own roster.",
    tech: ["TypeScript", "Simulation", "Procedural generation", "React"],
    links: [{ label: "Run it in the arcade", href: "/games/hunger-games" }],
    mark: "SIM",
    accent: "#647a55",
  },
  {
    title: "This website",
    period: "Ongoing",
    description:
      "The lab itself: Next.js App Router, Prisma, and NextAuth with role-based admin, a markdown blog with live-preview editor, an arcade with per-user save states, and the photo-notebook design system you're looking at.",
    tech: ["Next.js", "TypeScript", "Prisma", "NextAuth"],
    links: [{ label: "Read the about page", href: "/about" }],
    mark: "LAB",
    accent: "#786251",
  },
];

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
        Selected data science, machine learning, and full-stack work — plus the experiments that
        keep the lab fun. Code lives on{" "}
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

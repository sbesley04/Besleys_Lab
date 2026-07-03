import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { splitTechStack } from "@/lib/techstack";

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
}

const featured: Featured[] = [
  {
    title: "EpsTracked — document analysis dashboard",
    period: "Spring 2026 · CS/QTM/LING 329",
    description:
      "Full-stack NLP application for exploring events and entities extracted from the publicly released Epstein document corpus. A Python pipeline classified 2,599 events across 787 document threads and surfaced 515 unique entities; a React/TypeScript multi-view dashboard makes the corpus searchable.",
    tech: ["Python", "Transformers", "NLP", "React", "TypeScript", "Vercel"],
    links: [{ label: "Live app", href: "https://eps-tracked.vercel.app", external: true }],
  },
  {
    title: "NYC Airbnb price prediction",
    period: "Spring 2026 · QTM 347",
    description:
      "Price model over 48,000+ NYC listings combining structured features with NLP signals mined from listing names (luxury keywords, capitalization ratio, word statistics). Benchmarked OLS, Ridge, LASSO, and Random Forest; the text features added real signal beyond location and room type.",
    tech: ["Python", "scikit-learn", "pandas", "Feature engineering"],
    links: [],
  },
  {
    title: "Hunger Games simulator",
    period: "Ongoing lab experiment",
    description:
      "A deterministic, trait-driven arena simulation: procedural biome terrain, weather systems, alliances and betrayals, and a narrative event feed. Started life as a Python prototype; now a TypeScript engine you can play right here — bring your own roster.",
    tech: ["TypeScript", "Simulation", "Procedural generation", "React"],
    links: [{ label: "Run it in the arcade", href: "/games/hunger-games" }],
  },
  {
    title: "This website",
    period: "Ongoing",
    description:
      "The lab itself: Next.js App Router, Prisma, and NextAuth with role-based admin, a markdown blog with live-preview editor, an arcade with per-user save states, and the photo-notebook design system you're looking at.",
    tech: ["Next.js", "TypeScript", "Prisma", "NextAuth"],
    links: [{ label: "Read the about page", href: "/about" }],
  },
];

const tagStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  padding: "0.15rem 0.5rem",
  border: "1px solid var(--line)",
  borderRadius: 999,
  color: "var(--ink-soft)",
};

export default async function ProjectsIndex() {
  // The DB shelf is additive — if the query fails the page still renders the
  // featured section.
  const projects = await prisma.project
    .findMany({ where: { published: true }, orderBy: { createdAt: "desc" } })
    .catch(() => []);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0 0 0.25rem" }}>
        Projects &amp; lab work
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "2rem", maxWidth: "56ch" }}>
        Selected data science, machine learning, and full-stack work — plus the experiments that
        keep the lab fun. Code lives on{" "}
        <a href="https://github.com/sbesley04" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        .
      </p>

      {/* --- Featured lab work --- */}
      <section aria-label="Featured lab work" style={{ display: "grid", gap: "1.25rem" }}>
        {featured.map((f) => (
          <article key={f.title} className="paper-card" style={{ padding: "1.5rem 1.6rem" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "0.25rem 1rem",
              }}
            >
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.45rem", margin: 0 }}>
                {f.title}
              </h2>
              <span style={{ color: "var(--ink-soft)", fontSize: "0.8rem" }}>{f.period}</span>
            </div>
            <p style={{ color: "var(--ink-soft)", margin: "0.6rem 0 0.8rem", fontSize: "0.95rem" }}>
              {f.description}
            </p>
            <ul
              style={{
                listStyle: "none",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.4rem",
                padding: 0,
                margin: 0,
              }}
            >
              {f.tech.map((t) => (
                <li key={t} style={tagStyle}>
                  {t}
                </li>
              ))}
            </ul>
            {f.links.length > 0 && (
              <p style={{ margin: "0.9rem 0 0", fontSize: "0.9rem", display: "flex", gap: "1.25rem" }}>
                {f.links.map((l) =>
                  l.external ? (
                    <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label} ↗
                    </a>
                  ) : (
                    <Link key={l.href} href={l.href}>
                      {l.label} →
                    </Link>
                  ),
                )}
              </p>
            )}
          </article>
        ))}
      </section>

      {/* --- Admin-managed shelf --- */}
      {projects.length > 0 && (
        <section aria-label="More projects" style={{ marginTop: "2.5rem" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", margin: "0 0 1rem" }}>
            From the shelf
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              gap: "1.25rem",
            }}
          >
            {projects.map((p) => {
              const tags = splitTechStack(p.techStack);
              return (
                <article
                  key={p.id}
                  className="paper-card"
                  style={{ padding: "1.4rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}
                >
                  {p.thumbnail && (
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: 140,
                        borderRadius: 4,
                        overflow: "hidden",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <Image
                        src={p.thumbnail}
                        alt={`${p.title} thumbnail`}
                        fill
                        sizes="(max-width: 600px) 100vw, 260px"
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                  )}
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: 0 }}>
                    {p.title}
                  </h3>
                  <p style={{ color: "var(--ink-soft)", margin: 0, fontSize: "0.95rem" }}>
                    {p.description}
                  </p>
                  {tags.length > 0 && (
                    <ul
                      style={{
                        listStyle: "none",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.4rem",
                        padding: 0,
                        margin: 0,
                      }}
                    >
                      {tags.map((tag) => (
                        <li key={tag} style={tagStyle}>
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
                      style={{ fontSize: "0.9rem" }}
                    >
                      View on GitHub →
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

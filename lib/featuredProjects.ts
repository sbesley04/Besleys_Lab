// Curated, code-defined project highlights. Shared by /projects (full
// dossiers) and the home page (selected work) so the two never drift.
// Always present — no database required.

export interface FeaturedProject {
  title: string;
  period: string;
  description: string;
  tech: string[];
  links: { label: string; href: string; external?: boolean }[];
  mark: string;
  /** CSS color for the dossier stripe — one of the --dossier-* tokens. */
  accent: string;
}

export const featuredProjects: FeaturedProject[] = [
  {
    title: "EpsTracked — document analysis dashboard",
    period: "Spring 2026 · CS/QTM/LING 329",
    description:
      "Full-stack NLP application for exploring events and entities extracted from the publicly released Epstein document corpus. A Python pipeline classified 2,599 events across 787 document threads and surfaced 515 unique entities; a React/TypeScript multi-view dashboard makes the corpus searchable.",
    tech: ["Python", "Transformers", "NLP", "React", "TypeScript", "Vercel"],
    links: [{ label: "Live app", href: "https://eps-tracked.vercel.app", external: true }],
    mark: "NLP",
    accent: "var(--dossier-slate)",
  },
  {
    title: "NYC Airbnb price prediction",
    period: "Spring 2026 · QTM 347",
    description:
      "Price model over 48,000+ NYC listings combining structured features with NLP signals mined from listing names (luxury keywords, capitalization ratio, word statistics). Benchmarked OLS, Ridge, LASSO, and Random Forest; the text features added real signal beyond location and room type.",
    tech: ["Python", "scikit-learn", "pandas", "Feature engineering"],
    links: [],
    mark: "48K",
    accent: "var(--dossier-clay)",
  },
  {
    title: "Hunger Games simulator",
    period: "Ongoing lab experiment",
    description:
      "A deterministic, trait-driven arena simulation: procedural biome terrain, weather systems, alliances and betrayals, and a narrative event feed. Started life as a Python prototype; now a TypeScript engine you can play right here — bring your own roster.",
    tech: ["TypeScript", "Simulation", "Procedural generation", "React"],
    links: [{ label: "Run it in the arcade", href: "/games/hunger-games" }],
    mark: "SIM",
    accent: "var(--dossier-moss)",
  },
  {
    title: "This website",
    period: "Ongoing",
    description:
      "The lab itself: Next.js App Router, Prisma, and NextAuth with role-based admin, a markdown blog with live-preview editor, an arcade with per-user save states, and the photo-notebook design system you're looking at.",
    tech: ["Next.js", "TypeScript", "Prisma", "NextAuth"],
    links: [{ label: "Read the about page", href: "/about" }],
    mark: "LAB",
    accent: "var(--dossier-bark)",
  },
];

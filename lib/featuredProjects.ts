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
    title: "BARI-CNS Research Workspace",
    period: "Oct 2026 – present · Emory University",
    description:
      "Offline desktop app (macOS and Windows) that lets a research lab explore longitudinal study spreadsheets without SQL. Workbooks import into SQLite with their provenance, QC highlights, and comments intact; on-demand statistics and PCA are validated against R, and every step is recorded as a reproducible R-syntax analysis log. A read-only MCP server lets AI assistants query aggregate results with small-cell suppression.",
    tech: ["TypeScript", "Electron", "React", "SQLite", "Statistics", "R", "MCP"],
    links: [{ label: "Code available on request", href: "/contact" }],
    mark: "R&D",
    accent: "var(--dossier-moss)",
  },
  {
    title: "Albi — data-visualization studio",
    period: "Fall 2026 · Personal project",
    description:
      "A macOS app for writing editorial data notebooks (narrative, charts, maps, annotations) that export as one self-contained, offline HTML file. Rust core for the data engine, validation, and export; one TypeScript renderer shared by the app and exports. Imports a 1M-row CSV in about 1.3 s, reads CSV/Parquet/spreadsheets/SQLite/PostgreSQL, and ships a 38-tool MCP server so AI edits go through the same undoable commands as the UI. Exports pass automated WCAG 2.2 AA audits.",
    tech: ["Rust", "TypeScript", "Svelte", "Data viz", "MCP", "Accessibility"],
    links: [{ label: "Code available on request", href: "/contact" }],
    mark: "VIZ",
    accent: "var(--dossier-slate)",
  },
  {
    title: "EpsTracked — document analysis dashboard",
    period: "Spring 2026 · CS/QTM/LING 329",
    description:
      "Full-stack NLP application over the publicly released Epstein document corpus. A Python pipeline used LLM-based structured extraction (Anthropic API) to pull 2,599 events from 787 document threads, classify them into six event types with likelihood scores, and resolve 515 unique entities; a React/TypeScript multi-view dashboard makes the corpus searchable.",
    tech: ["Python", "LLM extraction", "NLP", "React", "TypeScript", "Vercel"],
    links: [
      { label: "Live app", href: "https://eps-tracked.vercel.app", external: true },
      { label: "Code", href: "https://github.com/sbesley04/EpsTracked", external: true },
    ],
    mark: "NLP",
    accent: "var(--dossier-clay)",
  },
  {
    title: "NYC Airbnb price prediction",
    period: "Spring 2026 · QTM 347",
    description:
      "Price model over 48,000+ NYC listings combining structured features with NLP signals mined from listing names (luxury keywords, capitalization ratio, word statistics). Benchmarked OLS, Ridge, LASSO, and Random Forest, reaching R² 0.53 and ~$60 MAE; the text features added real signal beyond location and room type.",
    tech: ["Python", "scikit-learn", "pandas", "Feature engineering"],
    links: [
      { label: "Code & report", href: "https://github.com/sbesley04/ML-Airbnb-Project", external: true },
    ],
    mark: "48K",
    accent: "var(--dossier-bark)",
  },
  {
    title: "The Lab — ML from scratch",
    period: "Ongoing",
    description:
      "Nine interactive machine-learning demos (gradient descent, learning-rate schedules, k-means, SVM, regression, an XOR network, Bayesian updating, Markov text, Q-learning) written from scratch in TypeScript with no ML libraries. Each runs on a pure, seeded engine with its own tests: gradients are checked against finite differences and k-means inertia is asserted non-increasing.",
    tech: ["TypeScript", "Machine learning", "Optimization", "Canvas"],
    links: [{ label: "Try the demos", href: "/lab" }],
    mark: "ML",
    accent: "var(--dossier-slate)",
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
      "The lab itself: Next.js App Router, Prisma, and NextAuth with role-based admin, a markdown blog with live-preview editor, an arcade of 13 hand-built games with per-user saves and achievements, and the photo-notebook design system you're looking at.",
    tech: ["Next.js", "TypeScript", "Prisma", "NextAuth"],
    links: [
      { label: "Read the about page", href: "/about" },
      { label: "Code", href: "https://github.com/sbesley04/Besleys_Lab", external: true },
    ],
    mark: "LAB",
    accent: "var(--dossier-bark)",
  },
];

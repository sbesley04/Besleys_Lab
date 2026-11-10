import Link from "next/link";

// Web version of the resume — same content as /resume.pdf, lightly edited for
// the web and kept in sync by hand. EXTEND HERE: update both this page and
// public/resume.pdf when the resume changes. The PDF is generated from
// scripts/resume/resume.html (see that file for the one command).
export const metadata = {
  title: "Resume",
  description:
    "Samuel Besley — Data Scientist & ML Engineer. Research software developer at Emory University; B.S. in Data Science (2026). Research data tools, statistics validated against R, NLP pipelines, and full-stack data applications.",
};

const h2: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "1.35rem",
  margin: "2rem 0 0.75rem",
  paddingBottom: "0.3rem",
  borderBottom: "1px solid var(--line)",
};

const entryHead: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "0.2rem 1rem",
};

const period: React.CSSProperties = { color: "var(--ink-soft)", fontSize: "0.85rem", whiteSpace: "nowrap" };
const org: React.CSSProperties = { color: "var(--ink-soft)", fontSize: "0.92rem", margin: "0.1rem 0 0.35rem" };
const ul: React.CSSProperties = { margin: "0.25rem 0 0", paddingLeft: "1.2rem", fontSize: "0.95rem", lineHeight: 1.65 };

function Entry({
  title,
  where,
  when,
  bullets,
}: {
  title: string;
  where?: string;
  when: string;
  bullets: string[];
}) {
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <div style={entryHead}>
        <h3 style={{ fontSize: "1.05rem", margin: 0 }}>{title}</h3>
        <span style={period}>{when}</span>
      </div>
      {where && <p style={org}>{where}</p>}
      {bullets.length > 0 && (
        <ul style={ul}>
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ResumePage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "0.5rem 1rem",
        }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--h1-size)", margin: 0 }}>
            Samuel Besley
          </h1>
          <p style={{ color: "var(--ink-soft)", margin: "0.25rem 0 0" }}>
            Data Scientist &amp; ML Engineer · Atlanta, GA
          </p>
        </div>
        <a
          href="/resume.pdf"
          download
          className="paper-card resume-download"
          style={{ padding: "0.55rem 1rem", fontSize: "0.92rem", color: "var(--ink)", fontWeight: 600 }}
        >
          <span aria-hidden="true">⇩</span> Download PDF
        </a>
      </header>

      <address className="resume-contact">
        <a href="mailto:sambesley04@gmail.com">sambesley04@gmail.com</a>
        <a href="https://linkedin.com/in/sbesley" target="_blank" rel="noopener noreferrer">
          linkedin.com/in/sbesley
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a href="https://github.com/sbesley04" target="_blank" rel="noopener noreferrer">
          github.com/sbesley04
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </address>

      <section aria-label="Summary">
        <h2 style={h2}>Summary</h2>
        <p style={{ fontSize: "0.98rem", lineHeight: 1.7, margin: 0 }}>
          Data scientist and research software developer with a B.S. in Data Science from Emory
          University. I build tools that put rigorous analysis in researchers&rsquo; hands: an
          offline study-data workspace with statistics validated against R, NLP pipelines using
          LLM-based extraction, classical ML models, and a Rust/TypeScript data-visualization
          studio. Comfortable across the whole lifecycle, from feature engineering and model
          evaluation to tested, shipped software. Seeking data scientist and ML engineer roles
          where applied ML has direct product or research impact.
        </p>
      </section>

      <section aria-label="Education">
        <h2 style={h2}>Education</h2>
        <Entry
          title="Emory University — B.S. in Data Science"
          where="International Studies track · Atlanta, GA"
          when="May 2026"
          bullets={[
            "Relevant coursework: Machine Learning (QTM 347), Natural Language Processing (CS/QTM/LING 329), Data Structures, Applied Regression, East European Politics, International Relations & Conflict.",
          ]}
        />
      </section>

      <section aria-label="Experience">
        <h2 style={h2}>Experience</h2>
        <Entry
          title="Research Software Developer"
          where="BARI-CNS Lab, Emory University · Atlanta, GA"
          when="Oct 2026 – Present"
          bullets={[
            "Built the lab's offline research workspace, an Electron/React/TypeScript desktop app for macOS and Windows that imports longitudinal study spreadsheets into SQLite while preserving source attribution, QC highlights, and comments, so researchers can explore data without SQL.",
            "Implemented on-demand statistics (Welch t, Mann–Whitney, ANOVA, Kruskal–Wallis with effect sizes and Holm-adjusted comparisons; Pearson/Spearman/Kendall; regression bands; correlation matrix; PCA), validated against R 4.3, with every step recorded as a reproducible R-syntax analysis log.",
            "Added a read-only MCP server that lets AI assistants query aggregate results with small-cell suppression and access logging; shipped four releases in five days, backed by 141 unit/integration tests and Playwright end-to-end tests.",
          ]}
        />
        <Entry
          title="Photographer & Communications Contributor"
          where="Oxford College of Emory University · Oxford, GA"
          when="Aug 2023 – May 2024"
          bullets={[
            "Conducted interviews and produced photo content for Emory's official communications team, published across institutional social media and web channels.",
            "Collaborated with faculty, staff, and students to tell institutional stories to external audiences.",
          ]}
        />
        <Entry
          title="Server & Bartender"
          where="Seven Acre Dairy (May – Aug 2024) and Everly (Aug 2022 – Sep 2023) · Madison, WI"
          when="2022 – 2024"
          bullets={[
            "Guest-facing service in high-volume environments — managing relationships and resolving issues in real time.",
          ]}
        />
        <Entry
          title="Volunteer Volleyball Coach"
          where="High Point Christian School · Madison, WI"
          when="Jun 2022 – Jul 2023"
          bullets={[
            "Led practices and clinics across age groups, drawing on 8+ years of competitive playing experience.",
          ]}
        />
      </section>

      <section aria-label="Projects">
        <h2 style={h2}>Projects</h2>
        <Entry
          title="Albi — data-visualization studio"
          where="Personal project · Rust, TypeScript, Svelte · code available on request"
          when="Fall 2026"
          bullets={[
            "Built a macOS app for writing editorial data notebooks that export as a single self-contained, offline HTML file; a Rust core handles the data engine, validation, and export, and one TypeScript renderer draws charts in both the app and the exports.",
            "Engineered a data layer that reads CSV, JSON, Parquet, spreadsheets, SQLite, and PostgreSQL with 13 recorded, reorderable preparation steps; a 1M-row CSV imports in ~1.3 s without freezing the UI.",
            "Shipped a 38-tool MCP server so AI assistants edit notebooks through the same validated, undoable commands as the UI; exports pass automated WCAG 2.2 AA audits and work with networking disabled in Chromium, WebKit, and Firefox.",
          ]}
        />
        <Entry
          title="EpsTracked — document analysis dashboard"
          where="Live at eps-tracked.vercel.app · CS/QTM/LING 329"
          when="Spring 2026"
          bullets={[
            "Built and deployed a full-stack NLP application for exploring events and entities in the publicly released Epstein document corpus.",
            "Engineered a Python pipeline using LLM-based structured extraction (Anthropic API) that pulled 2,599 events from 787 document threads, classified them into six event types with probabilistic likelihood scores, and resolved 515 unique entities.",
            "Designed an interactive React/TypeScript multi-view dashboard (events, entities, flagged, threads), deployed on Vercel.",
          ]}
        />
        <Entry
          title="NYC Airbnb price prediction"
          where="QTM 347 (Machine Learning)"
          when="Spring 2026"
          bullets={[
            "Trained a price model on 48,000+ NYC listings, combining structured features (location, room type) with NLP signals extracted from listing names.",
            "Engineered 25 features (luxury keyword frequency, capitalization ratio, word statistics); benchmarked OLS, Ridge, LASSO, and Random Forest.",
            "Reached R² 0.53 and ~$60 MAE on log-transformed prices — showing text features add real signal beyond structured data.",
          ]}
        />
        <Entry
          title="Besley's Lab — interactive ML demos"
          where="This site (/lab) · Next.js, TypeScript, Prisma"
          when="2026 – present"
          bullets={[
            "Implemented nine machine-learning demos from scratch with no ML libraries (gradient descent, k-means, SVM, regression, an XOR network, Bayesian updating, Q-learning), each on a pure, seeded engine with tests — gradients checked against finite differences, k-means inertia asserted non-increasing.",
          ]}
        />
      </section>

      <section aria-label="Leadership">
        <h2 style={h2}>Activities &amp; Leadership</h2>
        <Entry
          title="President, Volleyball Club"
          where="Oxford College of Emory University"
          when="2023 – 2024"
          bullets={[
            "Elected president; organized practices, managed club operations, and led recruitment across the student body.",
          ]}
        />
      </section>

      <section aria-label="Skills">
        <h2 style={h2}>Skills</h2>
        <ul style={ul}>
          <li>
            <strong>ML / NLP:</strong> regression modeling, Random Forest, Ridge/LASSO, PCA,
            transformers (BERT), RNNs, LLM-based structured extraction, text feature engineering
          </li>
          <li>
            <strong>Statistics:</strong> hypothesis testing (t, Mann–Whitney, ANOVA,
            Kruskal–Wallis), effect sizes, multiple-comparison correction, correlation, validation
            against R
          </li>
          <li>
            <strong>Programming:</strong> Python (pandas, scikit-learn, NumPy, Hugging Face),
            TypeScript/JavaScript, SQL, R, Rust, Java
          </li>
          <li>
            <strong>Tools:</strong> React, Next.js, Electron, SQLite, PostgreSQL, Vitest,
            Playwright, Git/GitHub, Jupyter, MCP (Model Context Protocol)
          </li>
          <li>
            <strong>Languages:</strong> English (native), German (proficient), Spanish (proficient)
          </li>
        </ul>
      </section>

      <p style={{ marginTop: "2.5rem", fontSize: "0.9rem" }}>
        <Link href="/contact" className="standalone-link">
          Get in touch <span aria-hidden="true">→</span>
        </Link>
      </p>
    </main>
  );
}

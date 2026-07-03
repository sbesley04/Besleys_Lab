import Link from "next/link";

// Web version of the resume — same content as /resume.pdf, lightly edited for
// the web and kept in sync by hand. EXTEND HERE: update both this page and
// public/resume.pdf when the resume changes.
export const metadata = {
  title: "Resume",
  description:
    "Samuel Besley — Data Scientist & ML Engineer. Emory University B.S. in Data Science (2026). NLP pipelines, machine learning models, full-stack data applications.",
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
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: 0 }}>
            Samuel Besley
          </h1>
          <p style={{ color: "var(--ink-soft)", margin: "0.25rem 0 0" }}>
            Data Scientist &amp; ML Engineer · Atlanta, GA
          </p>
        </div>
        <a
          href="/resume.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="paper-card"
          style={{ padding: "0.55rem 1rem", fontSize: "0.92rem", color: "var(--ink)", fontWeight: 600 }}
        >
          ⇩ Download PDF
        </a>
      </header>

      <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", margin: "0.75rem 0 0" }}>
        <a href="mailto:sambesley04@gmail.com">sambesley04@gmail.com</a>
        {" · "}
        <a href="https://linkedin.com/in/sbesley" target="_blank" rel="noopener noreferrer">
          linkedin.com/in/sbesley
        </a>
        {" · "}
        <a href="https://github.com/sbesley04" target="_blank" rel="noopener noreferrer">
          github.com/sbesley04
        </a>
      </p>

      <section aria-label="Summary">
        <h2 style={h2}>Summary</h2>
        <p style={{ fontSize: "0.98rem", lineHeight: 1.7, margin: 0 }}>
          Data science student at Emory University with hands-on experience building NLP
          pipelines, training and evaluating machine learning models, and deploying full-stack
          data applications. Proficient in Python, scikit-learn, and transformer-based NLP (BERT,
          Hugging Face); comfortable across the full modeling lifecycle from feature engineering
          to deployment. Seeking data scientist and ML engineer roles where applied ML has direct
          product impact.
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

      <section aria-label="Projects">
        <h2 style={h2}>Projects</h2>
        <Entry
          title="EpsTracked — document analysis dashboard"
          where="Live at eps-tracked.vercel.app · CS/QTM/LING 329"
          when="Spring 2026"
          bullets={[
            "Built and deployed a full-stack NLP application for exploring events and entities extracted from the publicly released Epstein document corpus.",
            "Engineered a Python pipeline that extracted and classified 2,599 events across 787 document threads — typed (communicative, concealment, financial, relational) with probabilistic trafficking-likelihood scores — and identified 515 unique entities.",
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
      </section>

      <section aria-label="Experience">
        <h2 style={h2}>Experience</h2>
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
          where="Seven Acre Dairy · Madison, WI"
          when="May – Aug 2024"
          bullets={[
            "Guest-facing service in a high-volume environment — managing relationships and resolving issues in real time.",
          ]}
        />
        <Entry
          title="Server & Bartender"
          where="Everly · Madison, WI"
          when="Aug 2022 – Sep 2023"
          bullets={[]}
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
            <strong>ML / NLP:</strong> regression modeling, Random Forest, Ridge/LASSO,
            transformers (BERT), RNNs, text feature engineering
          </li>
          <li>
            <strong>Programming:</strong> Python (pandas, scikit-learn, NumPy, Hugging Face), SQL,
            R, Java, JavaScript/TypeScript
          </li>
          <li>
            <strong>Tools:</strong> Jupyter, Git/GitHub, Excel, PyCharm
          </li>
          <li>
            <strong>Languages:</strong> English (native), German (proficient), Spanish (proficient)
          </li>
        </ul>
      </section>

      <p style={{ marginTop: "2.5rem", fontSize: "0.9rem" }}>
        <Link href="/contact">Get in touch →</Link>
      </p>
    </main>
  );
}

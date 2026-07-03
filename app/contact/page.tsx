import Link from "next/link";

// Contact page — the ways to reach Sam, pulled from the resume so they stay
// consistent: email, LinkedIn, GitHub, plus the resume itself.
export const metadata = {
  title: "Contact",
  description:
    "Get in touch with Samuel Besley — data scientist and full-stack developer. Email, LinkedIn, GitHub, and resume.",
};

const channels = [
  {
    label: "Email",
    value: "sambesley04@gmail.com",
    href: "mailto:sambesley04@gmail.com",
    blurb: "The fastest way to reach me — I read everything.",
    external: false,
  },
  {
    label: "LinkedIn",
    value: "linkedin.com/in/sbesley",
    href: "https://linkedin.com/in/sbesley",
    blurb: "For roles, referrals, and professional hellos.",
    external: true,
  },
  {
    label: "GitHub",
    value: "github.com/sbesley04",
    href: "https://github.com/sbesley04",
    blurb: "Where the code lives — including this site.",
    external: true,
  },
];

export default function ContactPage() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0 0 0.25rem" }}>
        Contact
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "2rem", maxWidth: "50ch" }}>
        I&rsquo;m Sam — a data scientist and full-stack developer based in Atlanta, graduating from
        Emory in May 2026 and looking for data science and ML engineering roles. If something here
        caught your eye, I&rsquo;d genuinely love to hear from you.
      </p>

      <div style={{ display: "grid", gap: "1rem" }}>
        {channels.map((c) => (
          <a
            key={c.label}
            href={c.href}
            {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="paper-card"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "0.25rem 1rem",
              padding: "1.2rem 1.4rem",
              color: "var(--ink)",
            }}
          >
            <span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 600 }}>
                {c.label}
              </span>
              <span style={{ display: "block", color: "var(--ink-soft)", fontSize: "0.88rem", marginTop: "0.15rem" }}>
                {c.blurb}
              </span>
            </span>
            <span style={{ color: "var(--accent)", fontSize: "0.95rem" }}>
              {c.value} {c.external ? "↗" : "→"}
            </span>
          </a>
        ))}
      </div>

      <div
        className="paper-card"
        style={{ marginTop: "1.5rem", padding: "1.2rem 1.4rem", display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem 1rem" }}
      >
        <span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 600 }}>
            Resume
          </span>
          <span style={{ display: "block", color: "var(--ink-soft)", fontSize: "0.88rem", marginTop: "0.15rem" }}>
            Education, experience, projects, and skills — on one page.
          </span>
        </span>
        <span style={{ display: "flex", gap: "1.25rem", fontSize: "0.95rem" }}>
          <Link href="/resume">Read it here →</Link>
          <a href="/resume.pdf" target="_blank" rel="noopener noreferrer">
            PDF ↗
          </a>
        </span>
      </div>

      <p className="margin-note" style={{ marginTop: "2rem" }}>
        no forms, no funnels — just say hi ✌︎
      </p>
    </main>
  );
}

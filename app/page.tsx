import Link from "next/link";
import Snapshot from "./_components/Snapshot";
import FieldNotebook from "./_components/FieldNotebook";
import { prisma } from "@/lib/prisma";
import { DEFAULT_FIELD_NOTES, type FieldNoteEntry } from "@/lib/fieldNotes";

// Hero photos are statically imported so next/image knows dimensions and can
// generate blur placeholders. The field-notebook strip below is managed from
// /admin/field-notes (falling back to lib/fieldNotes.ts defaults).
import donkeys from "@/public/photos/donkeys.jpg";
import farmDusk from "@/public/photos/farm-dusk.jpg";

// ---------------------------------------------------------------------------
// Home Page — the "desk". A hub of section cards laid out like objects on a
// writing desk, with a few photos taped in for good measure. Server Component.
//
// EXTEND HERE: to add a new section to the lab, append an entry to the
// `sections` array below.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

type Section = {
  href: string;
  title: string;
  blurb: string;
  glyph: string; // simple typographic mark, keeps the "ink on paper" feel
};

const sections: Section[] = [
  {
    href: "/blog",
    title: "Blog",
    blurb: "Markdown notes on data, models, and building things.",
    glyph: "¶",
  },
  {
    href: "/projects",
    title: "Projects",
    blurb: "Writeups with tech stacks, thumbnails, and GitHub links.",
    glyph: "❡",
  },
  {
    href: "/games",
    title: "Games",
    blurb: "A small arcade — including the Hunger Games simulator.",
    glyph: "▦",
  },
  {
    href: "/library",
    title: "Library",
    blurb: "A digital bookshelf: what I'm reading, with reviews.",
    glyph: "❧",
  },
  {
    href: "/about",
    title: "About",
    blurb: "Data scientist & full-stack developer. ML, analytics, web.",
    glyph: "✎",
  },
];

export default async function HomePage() {
  // Admin-managed strip photos; defaults keep the strip alive on a fresh DB.
  const dbNotes = await prisma.fieldNote
    .findMany({ orderBy: { position: "asc" } })
    .catch(() => []);
  const fieldNotes: FieldNoteEntry[] =
    dbNotes.length > 0
      ? dbNotes.map((n) => ({ id: n.id, image: n.image, alt: n.alt, caption: n.caption, tilt: n.tilt }))
      : DEFAULT_FIELD_NOTES;
  return (
    <main
      style={{
        maxWidth: 1040,
        margin: "0 auto",
        padding: "clamp(2.5rem, 7vw, 5rem) 1.5rem 3rem",
      }}
    >
      {/* --- Hero: intro copy beside a cluster of taped-in prints --- */}
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          alignItems: "center",
          gap: "clamp(2rem, 5vw, 3.5rem)",
          marginBottom: "clamp(3rem, 7vw, 4.5rem)",
        }}
      >
        <div>
          <p
            className="margin-note"
            style={{ margin: "0 0 0.25rem" }}
          >
            a personal site &amp; workshop
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.75rem, 8vw, 4.75rem)",
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            Besley&rsquo;s Lab
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
              color: "var(--ink-soft)",
              marginTop: "0.75rem",
              maxWidth: "42ch",
            }}
          >
            Data science, full-stack development, and a few fun experiments —
            written up from a desk that&rsquo;s usually within earshot of the
            donkeys.
          </p>
          <div
            aria-hidden
            style={{
              width: 64,
              height: 2,
              background: "var(--accent)",
              marginTop: "1.5rem",
              opacity: 0.7,
            }}
          />
        </div>

        <div className="photo-cluster" style={{ padding: "0.75rem 0.5rem" }}>
          <Snapshot
            src={donkeys}
            alt="Two donkeys poking their noses through a red farm gate"
            caption="the welcoming committee"
            tilt={-2.5}
            aspect="3 / 4"
            sizes="(max-width: 720px) 60vw, 300px"
            priority
          />
          <Snapshot
            src={farmDusk}
            alt="The family farm at dusk under a pink and blue sky"
            caption="home at dusk"
            tilt={3}
            aspect="4 / 3"
            sizes="(max-width: 720px) 50vw, 260px"
            priority
          />
        </div>
      </header>

      {/* --- Section cards: 2×2 desk grid --- */}
      <nav aria-label="Sections">
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: "1.25rem",
          }}
        >
          {sections.map((s) => (
            <li key={s.href} style={{ display: "flex" }}>
              <Link
                href={s.href}
                className="paper-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  padding: "1.75rem 1.5rem",
                  width: "100%",
                  color: "var(--ink)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.75rem",
                    color: "var(--accent)",
                    lineHeight: 1,
                  }}
                >
                  {s.glyph}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.6rem",
                    fontWeight: 600,
                  }}
                >
                  {s.title}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.95rem",
                    color: "var(--ink-soft)",
                  }}
                >
                  {s.blurb}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* --- Field notebook: a strip of snapshots from off-screen --- */}
      <section
        aria-label="Field notebook"
        style={{ marginTop: "clamp(3rem, 7vw, 4.5rem)" }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.75rem",
            marginBottom: "0.15rem",
          }}
        >
          From the field notebook
        </h2>
        <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", margin: 0 }}>
          Proof that the laptop does occasionally get closed. Click a print to take a closer look.
        </p>
        <FieldNotebook notes={fieldNotes} />
      </section>
    </main>
  );
}

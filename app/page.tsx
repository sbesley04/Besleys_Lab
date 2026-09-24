import Link from "next/link";
import type { CSSProperties } from "react";
import FieldNotebook from "./_components/FieldNotebook";
import GridSwitch from "./_components/eggs/GridSwitch";
import GridHome from "./_components/eggs/GridHome";
import HomeHero from "./_components/home/HomeHero";
import { prisma } from "@/lib/prisma";
import { DEFAULT_FIELD_NOTES, type FieldNoteEntry } from "@/lib/fieldNotes";
import { featuredProjects } from "@/lib/featuredProjects";
import { games } from "@/app/games/registry";
import { demos } from "@/app/lab/registry";
import styles from "./home.module.css";

// The hero portrait is statically imported so next/image knows its dimensions
// and can generate the blur placeholder. The field-notebook strip below is
// managed from /admin/field-notes (falling back to lib/fieldNotes.ts defaults).
import headshot from "@/public/photos/headshot-glasses.jpg";

// ---------------------------------------------------------------------------
// Home page — the site's cover. Server Component: it reads counts and the
// latest posts from the DB and hands serializable props to the client hero
// (app/_components/home/HomeHero.tsx), which owns the scroll effects.
//
// Sections: hero (pinned portrait + scrolling "beats" about the site) →
// selected work (lib/featuredProjects.ts) → latest writing (only when posts
// exist) → field notebook. The Konami Grid swaps the whole paper subtree for
// GridHome, exactly as before.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function HomePage() {
  // Every query degrades independently: a cold or unreachable DB still
  // renders the page with defaults.
  const [dbNotes, posts, postCount, bookCount] = await Promise.all([
    prisma.fieldNote.findMany({ orderBy: { position: "asc" } }).catch(() => []),
    prisma.post
      .findMany({
        where: { published: true },
        orderBy: { publishedAt: "desc" },
        take: 3,
        select: { slug: true, title: true, excerpt: true, publishedAt: true },
      })
      .catch(() => []),
    prisma.post.count({ where: { published: true } }).catch(() => 0),
    prisma.book.count({ where: { published: true } }).catch(() => 0),
  ]);

  const fieldNotes: FieldNoteEntry[] =
    dbNotes.length > 0
      ? dbNotes.map((n) => ({ id: n.id, image: n.image, alt: n.alt, caption: n.caption, tilt: n.tilt }))
      : DEFAULT_FIELD_NOTES;

  const selected = featuredProjects.slice(0, 3);

  return (
    <GridSwitch
      grid={<GridHome />}
      paper={
        <main className={styles.page}>
          <HomeHero
            portrait={headshot}
            stats={{ games: games.length, demos: demos.length, posts: postCount, books: bookCount }}
          />

          {/* --- Selected work ------------------------------------------------ */}
          <section className={styles.section} aria-labelledby="selected-work-title">
            <div className={styles.sectionHead}>
              <h2 id="selected-work-title" className={styles.sectionTitle}>
                Selected work
              </h2>
              <Link href="/projects" className={styles.sectionLink}>
                All projects <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className={styles.workGrid}>
              {selected.map((p) => (
                <Link
                  key={p.title}
                  href="/projects"
                  className={styles.workCard}
                  style={{ "--work-accent": p.accent } as CSSProperties}
                >
                  <span className={styles.workMark}>{p.mark}</span>
                  <h3 className={styles.workTitle}>{p.title}</h3>
                  <p className={styles.workPeriod}>{p.period}</p>
                  <ul className={styles.tags} aria-label={`Technologies used for ${p.title}`}>
                    {p.tech.slice(0, 4).map((t) => (
                      <li key={t} className={styles.tag}>
                        {t}
                      </li>
                    ))}
                  </ul>
                </Link>
              ))}
            </div>
          </section>

          {/* --- Latest writing (hidden until there is something to show) ------ */}
          {posts.length > 0 && (
            <section className={styles.section} aria-labelledby="latest-writing-title">
              <div className={styles.sectionHead}>
                <h2 id="latest-writing-title" className={styles.sectionTitle}>
                  Latest writing
                </h2>
                <Link href="/blog" className={styles.sectionLink}>
                  All posts <span aria-hidden="true">→</span>
                </Link>
              </div>
              <ul className={styles.posts}>
                {posts.map((post) => (
                  <li key={post.slug}>
                    <Link href={`/blog/${post.slug}`} className={styles.post}>
                      <span className={styles.postDate}>
                        {post.publishedAt ? dateFmt.format(post.publishedAt) : ""}
                      </span>
                      <span className={styles.postTitle}>{post.title}</span>
                      {post.excerpt && <span className={styles.postExcerpt}>{post.excerpt}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* --- Field notebook ------------------------------------------------ */}
          <section className={styles.section} aria-labelledby="field-notebook-title">
            <div className={styles.sectionHead}>
              <h2 id="field-notebook-title" className={styles.sectionTitle}>
                Pictures
              </h2>
            </div>
            <p className={styles.sectionIntro}>
              Some snippets from my life. Click a photo to take a closer look.
            </p>
            <FieldNotebook notes={fieldNotes} flat />
          </section>
        </main>
      }
    />
  );
}

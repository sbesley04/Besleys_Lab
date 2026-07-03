import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";

// Public blog index — published posts, newest first, with reading time and
// cover thumbnails. Server Component; drafts never reach this query.
export const metadata = {
  title: "Blog",
  description: "Notes on data science, machine learning, and building things — from Besley's Lab.",
};

export const dynamic = "force-dynamic";

function readingTime(words: number): string {
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export default async function BlogIndex() {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true, excerpt: true, publishedAt: true, coverImage: true, body: true },
  });

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0 0 0.25rem" }}>
        Blog
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "2rem" }}>
        Notes on data, models, and building things — written up as I learn them.
      </p>

      {posts.length === 0 ? (
        <div className="paper-card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--ink-soft)" }}>
            No posts published yet — the first one is being written. Check back soon.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "1.1rem" }}>
          {posts.map((post) => {
            const words = post.body.split(/\s+/).length;
            return (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="paper-card"
                  style={{
                    display: "flex",
                    gap: "1.1rem",
                    alignItems: "stretch",
                    padding: "1.25rem 1.4rem",
                    color: "var(--ink)",
                  }}
                >
                  {post.coverImage && (
                    <div
                      style={{
                        position: "relative",
                        width: 96,
                        minWidth: 96,
                        borderRadius: 4,
                        overflow: "hidden",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <Image
                        src={post.coverImage}
                        alt=""
                        fill
                        sizes="96px"
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", margin: 0 }}>
                      {post.title}
                    </h2>
                    <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", margin: "0.2rem 0 0" }}>
                      {post.publishedAt && (
                        <time dateTime={post.publishedAt.toISOString()}>
                          {post.publishedAt.toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </time>
                      )}
                      {" · "}
                      {readingTime(words)}
                    </p>
                    {post.excerpt && (
                      <p style={{ margin: "0.5rem 0 0", color: "var(--ink-soft)", fontSize: "0.95rem" }}>
                        {post.excerpt}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

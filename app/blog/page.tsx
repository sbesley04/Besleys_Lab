import Link from "next/link";
import Image from "next/image";
import { isExternalImage } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import GrubJar from "@/app/_components/eggs/GrubJar";
import styles from "./blog.module.css";

// Public blog index — published posts, newest first, with reading time and
// cover thumbnails. Server Component; drafts never reach this query.
export const metadata = {
  title: "Blog",
  description: "Some of the work I've done in writing and a space for new thoughts",
};

export const dynamic = "force-dynamic";

function readingTime(words: number): string {
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export default async function BlogIndex() {
  // Keep an outage distinct from a genuinely empty blog so visitors are not
  // told that published work has disappeared.
  const posts = await prisma.post
    .findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, title: true, excerpt: true, publishedAt: true, coverImage: true, body: true },
    })
    .catch(() => null);

  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Blog</h1>
      <p className={styles.intro}>
        Some of the work I've done in writing and a space for new thoughts
      </p>

      {posts === null ? (
        <div className={`paper-card ${styles.statusCard}`} role="status">
          <p>The notebook could not be opened just now. Please try again in a moment.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className={`paper-card ${styles.statusCard}`}>
          <p>
            No posts published yet — the first one is being written. Check back soon.
          </p>
        </div>
      ) : (
        <ul className={styles.postList}>
          {posts.map((post, index) => {
            const words = post.body.split(/\s+/).length;
            return (
              <li key={post.slug} className={styles.postItem}>
                <Link
                  href={`/blog/${post.slug}`}
                  className={`paper-card ${styles.postCard} ${post.coverImage ? "" : styles.postCardNoImage}`}
                >
                  {post.coverImage && (
                    <div className={styles.thumbnail}>
                      <Image
                        src={post.coverImage}
                        alt=""
                        fill
                        sizes="(max-width: 520px) calc(100vw - 4rem), 96px"
                        unoptimized={isExternalImage(post.coverImage)}
                        style={{ objectFit: "cover" }}
                        priority={index === 0}
                      />
                    </div>
                  )}
                  <div className={styles.postContent}>
                    <h2 className={styles.postTitle}>{post.title}</h2>
                    <p className={styles.postMeta}>
                      {post.publishedAt ? (
                        <>
                          <time dateTime={post.publishedAt.toISOString()}>
                            {post.publishedAt.toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </time>
                          {" · "}
                        </>
                      ) : null}
                      {readingTime(words)}
                    </p>
                    {post.excerpt && (
                      <p className={styles.excerpt}>{post.excerpt}</p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <GrubJar />
    </main>
  );
}

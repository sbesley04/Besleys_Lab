import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isStaff } from "@/lib/validation";
import { renderMarkdown } from "@/lib/markdown";
import type { Metadata } from "next";
import { isExternalImage } from "@/lib/images";
import { cache } from "react";
import styles from "../blog.module.css";

// Single post. Renders stored markdown to HTML on the server. Visitors only
// see published posts; signed-in staff can preview drafts (with a badge).
export const dynamic = "force-dynamic";

const getPost = cache((slug: string) =>
  prisma.post.findUnique({ where: { slug } }).catch(() => null),
);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || !post.published) return { title: "Post" };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    authors: [{ name: "Samuel Besley" }],
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
      ...(post.publishedAt ? { publishedTime: post.publishedAt.toISOString() } : {}),
      ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // On a DB error, fall through to notFound() rather than crashing the page.
  const post = await getPost(slug);
  if (!post) notFound();

  // Draft preview is staff-only.
  if (!post.published) {
    const session = await getSession();
    if (!isStaff(session?.user?.role)) notFound();
  }

  const html = renderMarkdown(post.body);
  const words = post.body.split(/\s+/).length;

  return (
    <main className={styles.articlePage}>
      <Link href="/blog" className={styles.backLink}>
        ← Blog
      </Link>
      <article>
        {!post.published && (
          <p className={styles.draftBadge}>
            Draft preview — not public
          </p>
        )}
        <h1 className={styles.articleTitle}>{post.title}</h1>
        <p className={styles.articleMeta}>
          {post.publishedAt && (
            <time dateTime={post.publishedAt.toISOString()}>
              {post.publishedAt.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          )}
          {post.publishedAt && " · "}
          {Math.max(1, Math.round(words / 200))} min read
        </p>
        {post.coverImage && (
          <div className={styles.cover}>
            <Image
              src={post.coverImage}
              alt={`${post.title} cover`}
              fill
              sizes="(max-width: 720px) 100vw, 700px"
              unoptimized={isExternalImage(post.coverImage)}
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
        )}
        {html.trim() ? (
          <div className={`prose ${styles.prose}`} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className={styles.emptyBody}>This note is still being assembled.</p>
        )}
      </article>
    </main>
  );
}

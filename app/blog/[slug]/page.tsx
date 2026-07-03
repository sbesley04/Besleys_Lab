import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isStaff } from "@/lib/validation";
import type { Metadata } from "next";

// Single post. Renders stored markdown to HTML on the server. Visitors only
// see published posts; signed-in staff can preview drafts (with a badge).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug },
    select: { title: true, excerpt: true, coverImage: true, published: true },
  });
  if (!post || !post.published) return { title: "Post" };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
      ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
    },
  };
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await prisma.post.findUnique({ where: { slug: params.slug } });
  if (!post) notFound();

  // Draft preview is staff-only.
  if (!post.published) {
    const session = await getSession();
    if (!isStaff(session?.user?.role)) notFound();
  }

  const html = marked.parse(post.body, { async: false }) as string;
  const words = post.body.split(/\s+/).length;

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/blog" style={{ fontSize: "0.9rem" }}>
        ← Blog
      </Link>
      <article>
        {!post.published && (
          <p
            style={{
              display: "inline-block",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              border: "1px solid rgba(155,58,47,0.4)",
              color: "#7c2d23",
              borderRadius: 999,
              padding: "0.15rem 0.6rem",
              margin: "0.75rem 0 0",
            }}
          >
            Draft preview — not public
          </p>
        )}
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0.5rem 0 0.35rem" }}>
          {post.title}
        </h1>
        <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: 0 }}>
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
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "2 / 1",
              margin: "1.5rem 0 0",
              borderRadius: 6,
              overflow: "hidden",
              border: "1px solid var(--line)",
            }}
          >
            <Image
              src={post.coverImage}
              alt={`${post.title} cover`}
              fill
              sizes="(max-width: 720px) 100vw, 700px"
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
        )}
        <div className="prose" style={{ marginTop: "1.5rem" }} dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canEditContent } from "@/lib/validation";
import PostForm from "../_components/PostForm";

// Edit an existing post. Loads the record server-side and hydrates the form.
export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const session = await requireStaff();
  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) notFound();
  // Editors can only open their own posts; treat others as not found.
  if (!canEditContent(session.user.role, session.user.id, post.authorId)) notFound();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/admin/blog" style={{ fontSize: "0.9rem" }}>
        ← Posts
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.5rem 0 1.5rem" }}>
        Edit post
      </h1>
      <PostForm
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? "",
          body: post.body,
          coverImage: post.coverImage ?? "",
          published: post.published,
        }}
      />
    </main>
  );
}

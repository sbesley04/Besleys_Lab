import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canEditContent } from "@/lib/validation";
import PostForm from "../_components/PostForm";
import styles from "../../_components/accountArea.module.css";

// Edit an existing post. Loads the record server-side and hydrates the form.
export const dynamic = "force-dynamic";
export const metadata = { title: "Edit post — Admin" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) notFound();
  // Editors can only open their own posts; treat others as not found.
  if (!canEditContent(session.user.role, session.user.id, post.authorId)) notFound();

  return (
    <main className={`${styles.page} ${styles.pageEditor} ${styles.accountPage}`}>
      <Link href="/admin/blog" className={styles.backLink}>
        ← Posts
      </Link>
      <h1 className={`${styles.pageTitle} ${styles.pageTitleAfterBack}`}>
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

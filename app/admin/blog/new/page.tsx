import Link from "next/link";
import { requireStaff } from "@/lib/session";
import PostForm from "../_components/PostForm";

// Create a new post. Guarded server-side; the form itself is a client island.
export default async function NewPostPage() {
  await requireStaff();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/admin/blog" style={{ fontSize: "0.9rem" }}>
        ← Posts
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.5rem 0 1.5rem" }}>
        New post
      </h1>
      <PostForm />
    </main>
  );
}

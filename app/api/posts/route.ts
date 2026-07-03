import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/api";
import { slugify } from "@/lib/slug";

// Collection endpoints for blog posts.
//   GET  /api/posts  → list all posts (admin only; includes drafts)
//   POST /api/posts  → create a post
//
// Public reads use the Prisma client directly in server components, so these
// routes are admin-only. EXTEND HERE: add query params for filtering/search.

export async function GET() {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const posts = await prisma.post.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.body) {
    return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  }

  const published = Boolean(body.published);
  const slug = body.slug ? slugify(body.slug) : slugify(body.title);

  try {
    const post = await prisma.post.create({
      data: {
        slug,
        title: body.title,
        excerpt: body.excerpt || null,
        body: body.body,
        coverImage: body.coverImage || null,
        published,
        publishedAt: published ? new Date() : null,
        authorId: auth.user.id,
      },
    });
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "A post with that slug already exists." }, { status: 409 });
    }
    throw err;
  }
}

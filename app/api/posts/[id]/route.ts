import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { canEditContent } from "@/lib/validation";

// Item endpoints for a single post.
//   PUT    /api/posts/:id → update
//   DELETE /api/posts/:id → delete
// Staff only; editors are limited to posts they authored, admins to any.

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.body) {
    return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  }

  const existing = await prisma.post.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canEditContent(auth.user.role, auth.user.id, existing.authorId)) {
    return NextResponse.json({ error: "You can only edit your own posts." }, { status: 403 });
  }

  const published = Boolean(body.published);
  const slug = body.slug ? slugify(body.slug) : existing.slug;

  // Set publishedAt the first time a post goes live; keep it stable afterward.
  const publishedAt = published ? existing.publishedAt ?? new Date() : null;

  try {
    const post = await prisma.post.update({
      where: { id: params.id },
      data: {
        slug,
        title: body.title,
        excerpt: body.excerpt || null,
        body: body.body,
        coverImage: body.coverImage || null,
        published,
        publishedAt,
      },
    });
    return NextResponse.json(post);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "A post with that slug already exists." }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const existing = await prisma.post.findUnique({
    where: { id: params.id },
    select: { authorId: true },
  });
  if (!existing) return NextResponse.json({ ok: true });
  if (!canEditContent(auth.user.role, auth.user.id, existing.authorId)) {
    return NextResponse.json({ error: "You can only delete your own posts." }, { status: 403 });
  }

  await prisma.post.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

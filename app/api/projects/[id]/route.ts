import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { normalizeTechStack } from "@/lib/techstack";
import { canEditContent } from "@/lib/validation";
import { isSafeExternalUrl, isSafeImageSource } from "@/lib/images";

// Item endpoints for a single project.
//   PUT    /api/projects/:id → update
//   DELETE /api/projects/:id → delete
// Staff only; editors are limited to projects they authored, admins to any.

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.description) {
    return NextResponse.json({ error: "Title and description are required." }, { status: 400 });
  }

  const thumbnail = typeof body.thumbnail === "string" && body.thumbnail.trim() ? body.thumbnail.trim() : null;
  const githubUrl = typeof body.githubUrl === "string" && body.githubUrl.trim() ? body.githubUrl.trim() : null;
  if (thumbnail && !isSafeImageSource(thumbnail)) {
    return NextResponse.json({ error: "Thumbnail must be a local image path or secure https URL." }, { status: 400 });
  }
  if (githubUrl && !isSafeExternalUrl(githubUrl)) {
    return NextResponse.json({ error: "GitHub URL must be a secure https URL." }, { status: 400 });
  }

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canEditContent(auth.user.role, auth.user.id, existing.authorId)) {
    return NextResponse.json({ error: "You can only edit your own projects." }, { status: 403 });
  }

  const slug = body.slug ? slugify(body.slug) : existing.slug;

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        slug,
        title: body.title,
        description: body.description,
        techStack: normalizeTechStack(body.techStack),
        thumbnail,
        githubUrl,
        published: Boolean(body.published),
      },
    });
    return NextResponse.json(project);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "A project with that slug already exists." }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const existing = await prisma.project.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!existing) return NextResponse.json({ ok: true });
  if (!canEditContent(auth.user.role, auth.user.id, existing.authorId)) {
    return NextResponse.json({ error: "You can only delete your own projects." }, { status: 403 });
  }

  await prisma.project.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

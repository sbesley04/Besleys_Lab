import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { normalizeTechStack } from "@/lib/techstack";
import { isSafeExternalUrl, isSafeImageSource } from "@/lib/images";

// Collection endpoints for projects (admin-only).
//   GET  /api/projects → list all (includes unpublished)
//   POST /api/projects → create

export async function GET() {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const projects = await prisma.project.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
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

  const slug = body.slug ? slugify(body.slug) : slugify(body.title);

  try {
    const project = await prisma.project.create({
      data: {
        slug,
        title: body.title,
        description: body.description,
        techStack: normalizeTechStack(body.techStack),
        thumbnail,
        githubUrl,
        published: Boolean(body.published),
        authorId: auth.user.id,
      },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "A project with that slug already exists." }, { status: 409 });
    }
    throw err;
  }
}

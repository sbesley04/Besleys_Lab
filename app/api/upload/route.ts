import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireApiStaff } from "@/lib/api";

// Image upload for project thumbnails (admin-only). Saves into public/uploads
// and returns a public URL path. Runs on the Node runtime so it can touch the
// filesystem.
//
// NOTE: local disk works for a single-instance deploy. For serverless/multi-
// instance hosting, swap the writeFile block for an object store (S3, R2,
// Vercel Blob) — the route contract (multipart in, { url } out) stays the same.
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.${EXT[file.type]}`;
  const dir = path.join(process.cwd(), "public", "uploads");

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
}

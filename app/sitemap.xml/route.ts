import { prisma } from "@/lib/prisma";

// Sitemap served from a route handler (see robots.txt/route.ts for why this
// isn't app/sitemap.ts): static pages plus published blog posts.
export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "",
  "/about",
  "/projects",
  "/blog",
  "/games",
  "/games/hunger-games",
  "/games/tetris",
  "/games/snake",
  "/games/2048",
  "/games/life",
  "/library",
  "/contact",
  "/resume",
];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Content queries shouldn't break the sitemap if the DB is unreachable.
  const [posts, books] = await Promise.all([
    prisma.post
      .findMany({ where: { published: true }, select: { slug: true, updatedAt: true } })
      .catch(() => []),
    prisma.book
      .findMany({ where: { published: true }, select: { slug: true, updatedAt: true } })
      .catch(() => []),
  ]);

  const urls = [
    ...STATIC_PATHS.map((p) => `  <url><loc>${esc(`${base}${p}`)}</loc></url>`),
    ...posts.map(
      (p) =>
        `  <url><loc>${esc(`${base}/blog/${p.slug}`)}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`,
    ),
    ...books.map(
      (b) =>
        `  <url><loc>${esc(`${base}/library/${b.slug}`)}</loc><lastmod>${b.updatedAt.toISOString()}</lastmod></url>`,
    ),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}

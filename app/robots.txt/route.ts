// Robots served from a plain route handler rather than app/robots.ts —
// Next 14's metadata-route loader embeds the absolute build path in generated
// code, which breaks on paths containing an apostrophe (this repo lives in
// "Besley's Lab"). A route handler sidesteps the loader entirely.
export const dynamic = "force-static";

export function GET(): Response {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const body = [
    "User-Agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api",
    "Disallow: /profile",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain" } });
}

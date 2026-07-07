import { requestOrigin } from "@/lib/baseUrl";

// Robots served from a plain route handler rather than app/robots.ts —
// Next 14's metadata-route loader embeds the absolute build path in generated
// code, which breaks on paths containing an apostrophe (this repo lives in
// "Besley's Lab"). A route handler sidesteps the loader entirely.
//
// Dynamic so the Sitemap: line points at the host actually serving this file —
// on the custom domain it advertises the custom-domain sitemap, on the
// .vercel.app URL the .vercel.app one. Each stays self-consistent for Google.
export const dynamic = "force-dynamic";

export function GET(): Response {
  const base = requestOrigin();
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

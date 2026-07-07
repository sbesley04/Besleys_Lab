import { headers } from "next/headers";

// Resolve the absolute origin (scheme + host) for the CURRENT request. Used by
// the sitemap and robots so they always reference the exact domain they're being
// served from — Google requires the URLs inside a sitemap to share the sitemap's
// host, and the site is reachable on more than one domain (the .vercel.app URL
// and the custom domain). Reading the host per-request keeps every domain's
// sitemap/robots self-consistent without hardcoding one canonical URL.
//
// On Vercel, `x-forwarded-host` / `x-forwarded-proto` carry the real external
// domain and scheme; only configured project domains ever reach the app, so this
// can't be spoofed to an outside host. Falls back to NEXT_PUBLIC_SITE_URL (then
// localhost) when no request headers are available.
export function requestOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

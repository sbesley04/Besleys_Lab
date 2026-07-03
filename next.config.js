/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This repo lives in an iCloud-synced Documents folder. iCloud evicts and
  // re-syncs files inside the default `.next` build dir while the dev server
  // runs, which corrupts the cache mid-session (symptom: routes that worked
  // suddenly 404/500 with MODULE_NOT_FOUND — including /api/auth, which
  // breaks login). Folders ending in `.nosync` are excluded from iCloud sync,
  // so the build cache stays intact locally. Vercel's builder requires the
  // standard `.next` output path (and has no iCloud), so only rename it off
  // the Vercel platform.
  distDir: process.env.VERCEL ? ".next" : ".next.nosync",
  images: {
    // Local thumbnails (/uploads/*) are optimized automatically. Allow any
    // HTTPS host too, since project thumbnails may be pasted as external URLs.
    // EXTEND HERE: tighten `hostname` to specific domains if you want to
    // restrict where images can be loaded from.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

module.exports = nextConfig;

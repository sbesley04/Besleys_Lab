/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // This repo lives in an iCloud-synced Documents folder. iCloud evicts and
  // re-syncs files inside the default `.next` build dir while the dev server
  // runs, which corrupts the cache mid-session (symptom: routes that worked
  // suddenly 404/500 with MODULE_NOT_FOUND — including /api/auth, which
  // breaks login). Folders ending in `.nosync` are excluded from iCloud sync,
  // so the build cache stays intact locally. Vercel's builder requires the
  // standard `.next` output path (and has no iCloud), so only rename it off
  // the Vercel platform.
  distDir: process.env.VERCEL ? ".next" : ".next.nosync",
  turbopack: {
    // The repository lives below another package-lock in the home directory;
    // pinning the root prevents Turbopack from treating that unrelated file as
    // the workspace boundary.
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

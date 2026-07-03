import type { Metadata } from "next";
import Link from "next/link";
import { Playfair_Display, Inter, Caveat } from "next/font/google";
import Providers from "./providers";
import SiteHeader from "./_components/SiteHeader";
import "./globals.css";

// next/font self-hosts the fonts and exposes them as CSS variables that
// globals.css references (--font-display / --font-body / --font-hand).
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

// Handwriting face for photo captions and margin notes.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-hand",
  display: "swap",
});

// SEO + social sharing defaults. Child pages set their own `title` and
// `description`, which flow into the template and Open Graph tags. Set
// NEXT_PUBLIC_SITE_URL in production so absolute OG URLs resolve.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Besley's Lab — data science, full-stack, and fun experiments",
    template: "%s — Besley's Lab",
  },
  description:
    "The personal site of Samuel Besley: data science and ML projects, a markdown blog, and a small arcade — including a fully playable Hunger Games simulator.",
  openGraph: {
    siteName: "Besley's Lab",
    type: "website",
    images: [{ url: "/photos/farm-dusk.jpg", width: 1800, height: 1350, alt: "The Besley farm at dusk" }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${caveat.variable}`}>
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <footer className="site-footer">
            <span>
              Besley&rsquo;s Lab — built by hand, one commit at a time.
            </span>
            <nav aria-label="Footer" style={{ display: "flex", gap: "1.1rem", flexWrap: "wrap" }}>
              <Link href="/contact">Contact</Link>
              <Link href="/resume">Resume</Link>
              <a href="https://github.com/sbesley04" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </nav>
            <span className="margin-note">thanks for stopping by ✌︎</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

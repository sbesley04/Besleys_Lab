import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Playfair_Display, Inter, Caveat, Michroma, IBM_Plex_Mono } from "next/font/google";
import Providers from "./providers";
import SiteHeader from "./_components/SiteHeader";
import AchievementToaster from "./_components/AchievementToaster";
import EggEffects from "./_components/eggs/EggEffects";
import ZoteHeckler from "./_components/eggs/ZoteHeckler";
import ThemeAtmosphere from "./_components/ThemeAtmosphere";
import SecretTerminal from "./_components/eggs/SecretTerminal";
import HyperspaceJump from "./_components/eggs/HyperspaceJump";
import GridText from "./_components/eggs/GridText";
import "./globals.css";
// Grid-only global styles (scoped under :root[data-egg='tron']).
import "./_styles/grid-motion.css";
import "./_styles/grid-hud.css";

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

// Secret "Grid" (Konami) faces — swapped in via tokens under data-egg="tron".
// Michroma: wide geometric display. IBM Plex Mono: readable mono body.
const michroma = Michroma({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-grid-display",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-grid-body",
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
    // suppressHydrationWarning: the inline script below sets data-theme on
    // <html> before hydration, which React would otherwise flag in dev.
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} ${caveat.variable} ${michroma.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Restore the saved theme + Grid egg before first paint (no flash). */}
        <Script
          id="restore-paper-lab-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('bl:theme');if(t)document.documentElement.dataset.theme=t;var e=sessionStorage.getItem('bl:egg');if(e)document.documentElement.dataset.egg=e;}catch(e){}",
          }}
        />
        <Providers>
          {/* Everything visible lives in #bl-stage so the hyperspace jump can
              blur/scale the whole page away while the starfield canvas (a
              sibling, below) stays sharp on top. */}
          <div id="bl-stage">
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
            <SiteHeader />
            <div id="main-content" className="site-content" tabIndex={-1}>
              {children}
            </div>
            <footer className="site-footer">
              <div className="site-footer-signoff">
                <span>
                  <GridText
                    paper={<>Besley&rsquo;s Lab — built by hand, one commit at a time.</>}
                    grid="BESLEY'S LAB // COMPILED BY HAND — END OF LINE"
                  />
                </span>
                <span className="margin-note">
                  <ThemeAtmosphere />
                  <GridText paper="thanks for stopping by ✌︎" grid="end of line ▮" />
                </span>
              </div>
              <div className="site-footer-navs">
                <nav aria-label="Explore" className="site-footer-nav">
                  <span className="site-footer-label" aria-hidden="true">Explore</span>
                  <Link href="/blog">Blog</Link>
                  <Link href="/projects">Projects</Link>
                  <Link href="/lab">Lab</Link>
                  <Link href="/games">Games</Link>
                  <Link href="/library">Library</Link>
                </nav>
                <nav aria-label="More information" className="site-footer-nav">
                  <span className="site-footer-label" aria-hidden="true">More</span>
                  <Link href="/about">About</Link>
                  <Link href="/contact">Contact</Link>
                  <Link href="/resume">Resume</Link>
                  <a href="https://github.com/sbesley04" target="_blank" rel="noopener noreferrer">
                    GitHub<span aria-hidden="true"> ↗</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </nav>
              </div>
            </footer>
          </div>
          <AchievementToaster />
          <EggEffects />
          <ZoteHeckler />
          <SecretTerminal />
          <HyperspaceJump />
        </Providers>
      </body>
    </html>
  );
}

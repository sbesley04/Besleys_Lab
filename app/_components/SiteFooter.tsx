import Link from "next/link";
import GridText from "./eggs/GridText";
import ThemeAtmosphere from "./ThemeAtmosphere";

// Site-wide footer (Server Component). Styling lives in globals.css under
// "Site footer" so it re-skins with the nine themes and the Grid for free.
export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
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
        <span className="site-footer-copyright">© {year} Samuel Besley</span>
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
          <Link href="/privacy">Privacy</Link>
          <a href="https://github.com/sbesley04" target="_blank" rel="noopener noreferrer">
            GitHub<span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}

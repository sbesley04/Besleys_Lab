"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useOnGrid } from "@/lib/grid";
import styles from "./siteHeader.module.css";

// Seeded so the Grid HUD reads as an already-running session, not 00:00:00.
const HUD_UPTIME_SEED = 3 * 3600 + 41 * 60 + 7;
function fmtUptime(s: number): string {
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// Site-wide top bar: brand, primary navigation, and the account menu. Reads
// the session on the client; shows sign-in/up links to guests and a profile
// dropdown to authenticated users (with an Admin link for staff).

const NAV = [
  { href: "/blog", label: "Blog", description: "Notes & field reports" },
  { href: "/projects", label: "Projects", description: "Selected work" },
  { href: "/lab", label: "Lab", description: "Interactive ML" },
  { href: "/games", label: "Games", description: "The arcade" },
  { href: "/library", label: "Library", description: "Books & reviews" },
  { href: "/about", label: "About", description: "Meet Samuel" },
  { href: "/contact", label: "Contact", description: "Start a conversation" },
];

export default function SiteHeader() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  // Grid HUD: a live-ish telemetry readout that only exists on the Grid.
  const onGrid = useOnGrid();
  const [uptime, setUptime] = useState(HUD_UPTIME_SEED);
  useEffect(() => {
    if (!onGrid) return;
    const id = setInterval(() => setUptime((u) => u + 1), 1000);
    return () => clearInterval(id);
  }, [onGrid]);
  const sector = pathname === "/" ? "ROOT" : (pathname?.split("/")[1] || "ROOT").toUpperCase();

  // Close the dropdown on outside click or Escape.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
      if (barRef.current && !barRef.current.contains(e.target as Node)) setNavOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (navOpen) {
          setNavOpen(false);
          navToggleRef.current?.focus();
        } else if (open) {
          setOpen(false);
          profileButtonRef.current?.focus();
        }
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [navOpen, open]);

  // The header persists between App Router navigations. Make sure a disclosure
  // opened on one route cannot arrive open on the next one (including browser
  // back/forward navigations that did not originate from one of our links).
  useEffect(() => {
    setOpen(false);
    setNavOpen(false);
  }, [pathname]);

  const user = session?.user;
  const isStaff = user?.role === "ADMIN" || user?.role === "EDITOR";
  const handle = user?.username || user?.name || user?.email || "";
  const initial = (user?.username || user?.name || user?.email || "?").charAt(0);
  const currentSection = NAV.find(
    (item) => pathname === item.href || pathname?.startsWith(`${item.href}/`),
  );

  return (
    <header className={styles.bar} ref={barRef}>
      <Link href="/" className={styles.brand} aria-label="Besley's Lab, home">
        Besley&rsquo;s Lab
      </Link>

      <button
        ref={navToggleRef}
        type="button"
        className={styles.navToggle}
        aria-expanded={navOpen}
        aria-controls="primary-navigation"
        aria-label={`${navOpen ? "Close" : "Open"} primary navigation${currentSection ? `; current section: ${currentSection.label}` : ""}`}
        onClick={() => {
          setNavOpen((shown) => !shown);
          setOpen(false);
        }}
      >
        <span>{navOpen ? "Close" : "Menu"}</span>
        {currentSection && <span className={styles.toggleSection}>{currentSection.label}</span>}
        <span className={`${styles.toggleChevron} ${navOpen ? styles.toggleChevronOpen : ""}`} aria-hidden="true">
          ⌄
        </span>
      </button>

      <nav id="primary-navigation" className={`${styles.nav} ${navOpen ? styles.navOpen : ""}`} aria-label="Primary">
        <span className={styles.navIntro} aria-hidden="true">Explore the lab</span>
        {NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const exact = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? styles.navLinkActive : styles.navLink}
              aria-current={active ? (exact ? "page" : "location") : undefined}
              onClick={() => setNavOpen(false)}
            >
              <span className={styles.navLabel}>{item.label}</span>
              <span className={styles.navDescription}>{item.description}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.right}>
        {onGrid && (
          <span className="grid-hud" aria-hidden="true">
            <span className="grid-hud__dot" />
            SYS:NOMINAL
            <span className="grid-hud__sep">·</span>
            {sector}
            <span className="grid-hud__sep">·</span>
            UP {fmtUptime(uptime)}
          </span>
        )}
        {status === "loading" ? (
          <span className={styles.accountPlaceholder} aria-hidden="true">
            <span />
            <i />
          </span>
        ) : user ? (
          <div className={styles.profileWrap} ref={wrapRef}>
            <button
              ref={profileButtonRef}
              type="button"
              className={styles.profileButton}
              onClick={() => {
                setOpen((o) => !o);
                setNavOpen(false);
              }}
              aria-expanded={open}
              aria-controls="account-navigation"
              aria-label={`${open ? "Close" : "Open"} account menu for ${handle}`}
            >
              <span className={styles.avatar} aria-hidden="true">{initial}</span>
              <span className={styles.handle}>{handle}</span>
            </button>

            {open && (
              <div className={styles.menu} id="account-navigation">
                <div className={styles.menuHeader}>
                  <div className={styles.menuName}>{user.username || user.name || "Account"}</div>
                  <div className={styles.menuMeta}>{user.email}</div>
                  <span className={styles.roleTag}>{user.role}</span>
                </div>

                <Link href="/profile" className={styles.menuItem} onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
                {isStaff && (
                  <Link href="/admin" className={styles.menuItem} onClick={() => setOpen(false)}>
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link
              href={`/login${pathname && pathname !== "/" ? `?callbackUrl=${encodeURIComponent(pathname)}` : ""}`}
              className={styles.link}
            >
              Sign in
            </Link>
            <Link href="/signup" className={styles.signupLink}>
              <span className={styles.signupFull}>Create account</span>
              <span className={styles.signupShort}>Sign up</span>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

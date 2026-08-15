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
  { href: "/blog", label: "Blog" },
  { href: "/projects", label: "Projects" },
  { href: "/lab", label: "Lab" },
  { href: "/games", label: "Games" },
  { href: "/library", label: "Library" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function SiteHeader() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const user = session?.user;
  const isStaff = user?.role === "ADMIN" || user?.role === "EDITOR";
  const handle = user?.username || user?.name || user?.email || "";
  const initial = (user?.username || user?.name || user?.email || "?").charAt(0);

  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.brand}>
        Besley&rsquo;s Lab
      </Link>

      <button
        type="button"
        className={styles.navToggle}
        aria-expanded={navOpen}
        aria-controls="primary-navigation"
        onClick={() => setNavOpen((shown) => !shown)}
      >
        {navOpen ? "Close" : "Menu"}
      </button>

      <nav id="primary-navigation" className={`${styles.nav} ${navOpen ? styles.navOpen : ""}`} aria-label="Primary">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? styles.navLinkActive : styles.navLink}
              aria-current={active ? "page" : undefined}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
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
        {status === "loading" ? null : user ? (
          <div className={styles.profileWrap} ref={wrapRef}>
            <button
              type="button"
              className={styles.profileButton}
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span className={styles.avatar}>{initial}</span>
              <span className={styles.handle}>{handle}</span>
            </button>

            {open && (
              <div className={styles.menu} role="menu">
                <div className={styles.menuHeader}>
                  <div className={styles.menuName}>{user.username || user.name || "Account"}</div>
                  <div className={styles.menuMeta}>{user.email}</div>
                  <span className={styles.roleTag}>{user.role}</span>
                </div>

                <Link href="/profile" className={styles.menuItem} role="menuitem" onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
                {isStaff && (
                  <Link href="/admin" className={styles.menuItem} role="menuitem" onClick={() => setOpen(false)}>
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  className={styles.menuItem}
                  role="menuitem"
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
              Create account
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

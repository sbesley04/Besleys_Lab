import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import SignOutButton from "./_components/SignOutButton";

// Admin dashboard — the protected hub for managing site content. Shows live
// counts so it's obvious what's published vs. drafted, plus quick actions for
// the two most common jobs (new post / new project). Middleware + requireStaff
// gate the whole /admin tree.

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const session = await requireStaff();

  const [postsPublished, postsDraft, projectsPublished, projectsDraft, userCount, bookCount, noteCount] =
    await Promise.all([
      prisma.post.count({ where: { published: true } }),
      prisma.post.count({ where: { published: false } }),
      prisma.project.count({ where: { published: true } }),
      prisma.project.count({ where: { published: false } }),
      prisma.user.count(),
      prisma.book.count(),
      prisma.fieldNote.count(),
    ]);

  const manage = [
    {
      href: "/admin/blog",
      title: "Blog posts",
      blurb: "Write, edit, and publish markdown posts with live preview.",
      stat: `${postsPublished} published · ${postsDraft} draft${postsDraft === 1 ? "" : "s"}`,
      action: { href: "/admin/blog/new", label: "New post →" },
    },
    {
      href: "/admin/projects",
      title: "Projects",
      blurb: "Curate the public projects shelf: writeups, tags, GitHub links.",
      stat: `${projectsPublished} published · ${projectsDraft} draft${projectsDraft === 1 ? "" : "s"}`,
      action: { href: "/admin/projects/new", label: "New project →" },
    },
    {
      href: "/admin/books",
      title: "Library",
      blurb: "Add books, design their spines, arrange the shelf, write reviews.",
      stat: `${bookCount} book${bookCount === 1 ? "" : "s"} on the shelf`,
      action: { href: "/admin/books/new", label: "Add book →" },
    },
    {
      href: "/admin/field-notes",
      title: "Field notebook",
      blurb: "The home-page photo strip: add prints, edit captions, reorder.",
      stat: noteCount > 0 ? `${noteCount} photo${noteCount === 1 ? "" : "s"}` : "using built-in defaults",
      action: { href: "/admin/field-notes", label: "Manage photos →" },
    },
    // Accounts management is admin-only; the card is hidden from EDITOR users.
    ...(session.user.role === "ADMIN"
      ? [
          {
            href: "/admin/users",
            title: "Accounts",
            blurb: "Create and manage user, editor, and admin logins.",
            stat: `${userCount} account${userCount === 1 ? "" : "s"}`,
            action: { href: "/admin/users/new", label: "New account →" },
          },
        ]
      : []),
  ];

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "0.5rem",
        }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>
            Admin
          </h1>
          <p style={{ color: "var(--ink-soft)", margin: "0.25rem 0 0" }}>
            Signed in as {session.user.email} · {session.user.role}
          </p>
        </div>
        <SignOutButton />
      </header>
      <p style={{ color: "var(--ink-soft)", margin: "0 0 2rem", fontSize: "0.92rem" }}>
        Manage what visitors see. Drafts stay private until you publish them.{" "}
        <Link href="/">View the live site →</Link>
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
          gap: "1.25rem",
        }}
      >
        {manage.map((m) => (
          <section key={m.href} className="paper-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: 0 }}>
              <Link href={m.href} style={{ color: "var(--ink)" }}>
                {m.title}
              </Link>
            </h2>
            <p style={{ color: "var(--ink-soft)", margin: 0, fontSize: "0.92rem" }}>{m.blurb}</p>
            <p style={{ color: "var(--ink-soft)", margin: "0.2rem 0 0", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {m.stat}
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
              <Link href={m.action.href}>{m.action.label}</Link>
              <span style={{ margin: "0 0.5rem", color: "var(--line)" }}>|</span>
              <Link href={m.href}>Manage</Link>
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}

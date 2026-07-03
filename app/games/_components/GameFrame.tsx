import Link from "next/link";

// Shared chrome for a single game page: a back link to the arcade and the
// title, with the game itself as children. Keeps every game page consistent
// and makes new ones trivial to add.
export default function GameFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/games" style={{ fontSize: "0.9rem" }}>
        ← Arcade
      </Link>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2.6rem",
          margin: "0.5rem 0 1.5rem",
        }}
      >
        {title}
      </h1>
      {children}
    </main>
  );
}

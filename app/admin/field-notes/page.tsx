import Link from "next/link";
import { requireStaff } from "@/lib/session";
import FieldNotesManager from "./_components/FieldNotesManager";

// Admin: manage the home page's "From the field notebook" photo strip.
export const dynamic = "force-dynamic";
export const metadata = { title: "Field notebook — Admin" };

export default async function AdminFieldNotesPage() {
  await requireStaff();

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <Link href="/admin" style={{ fontSize: "0.9rem" }}>
        ← Admin
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.5rem 0 0.25rem" }}>
        Field notebook
      </h1>
      <p style={{ color: "var(--ink-soft)", margin: "0 0 1.75rem", fontSize: "0.92rem" }}>
        The photo strip on the <Link href="/">home page</Link>. Photos expand full-screen when
        visitors click them — captions become the handwritten lines under each print.
      </p>
      <FieldNotesManager />
    </main>
  );
}

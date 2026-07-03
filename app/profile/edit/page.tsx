import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ProfileForm from "../_components/ProfileForm";

// Edit your own profile. Any signed-in account can use this.
export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, username: true, name: true },
  });

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/profile" style={{ fontSize: "0.9rem" }}>
        ← Profile
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0.5rem 0 1.5rem" }}>
        Edit profile
      </h1>
      <ProfileForm
        initial={{
          email: user?.email ?? session.user.email ?? "",
          username: user?.username ?? "",
          name: user?.name ?? "",
        }}
      />
    </main>
  );
}

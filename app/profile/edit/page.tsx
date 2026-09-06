import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ProfileForm from "../_components/ProfileForm";
import styles from "../../admin/_components/accountArea.module.css";

// Edit your own profile. Any signed-in account can use this.
export const dynamic = "force-dynamic";
export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, username: true, name: true, role: true },
  });

  return (
    <main className={`${styles.page} ${styles.pageNarrow} ${styles.accountPage}`}>
      <Link href="/profile" className={styles.backLink}>
        ← Profile
      </Link>
      <h1 className={`${styles.pageTitle} ${styles.pageTitleAfterBack}`}>
        Edit profile
      </h1>
      <ProfileForm
        initial={{
          email: user?.email ?? session.user.email ?? "",
          username: user?.username ?? "",
          name: user?.name ?? "",
        }}
        // Self-service deletion is offered to plain USER accounts only — see
        // the matching check in app/api/profile/route.ts's DELETE handler.
        canSelfDelete={(user?.role ?? session.user.role) === "USER"}
      />
    </main>
  );
}

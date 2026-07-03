import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Seeds the single admin user from env vars. Idempotent: re-running updates the
// password rather than creating duplicates. Run with `npm run db:seed`; it also
// runs during `vercel-build`, where missing/placeholder ADMIN_* vars just skip
// the seed (with a warning) instead of failing the deploy.
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";
  const username = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase();

  if (!email || !password || password === "change-me-before-seeding") {
    console.warn(
      "⚠ Seed skipped: set ADMIN_EMAIL and a real ADMIN_PASSWORD (not the placeholder) " +
        "in the environment to create/update the admin account.",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password.trim(), 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, username, role: "ADMIN" },
    create: { email, username, name, passwordHash, role: "ADMIN" },
  });

  console.log(`Seeded admin user: ${user.email} (@${user.username})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

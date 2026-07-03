import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Seeds the single admin user from env vars. Idempotent: re-running updates the
// password rather than creating duplicates. Run with `npm run db:seed`.
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";
  const username = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase();

  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

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

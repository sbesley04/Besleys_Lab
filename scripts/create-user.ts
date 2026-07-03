import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { isValidEmail, passwordProblem, usernameProblem, normalizeRole } from "../lib/validation";

// Create (or update) an account from the terminal — handy for bootstrapping the
// first admin or resetting a password without the UI.
//
//   npm run create-user -- <email> <username> <password> [name] [ADMIN|EDITOR|USER]
//
// Re-running with an existing email updates that account instead of creating a
// duplicate. Role defaults to ADMIN here (this is an operator tool).
const prisma = new PrismaClient();

async function main() {
  const [, , emailArg, usernameArg, password, nameArg, roleArg] = process.argv;

  if (!emailArg || !usernameArg || !password) {
    console.error("Usage: npm run create-user -- <email> <username> <password> [name] [ADMIN|EDITOR|USER]");
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const username = usernameArg.trim().toLowerCase();
  const name = nameArg ?? null;
  const role = roleArg ? normalizeRole(roleArg) : "ADMIN";

  if (!isValidEmail(email)) {
    console.error(`Invalid email: ${email}`);
    process.exit(1);
  }
  const unError = usernameProblem(username);
  if (unError) {
    console.error(unError);
    process.exit(1);
  }
  const pwError = passwordProblem(password);
  if (pwError) {
    console.error(pwError);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, username, name, role },
    create: { email, username, name, role, passwordHash },
    select: { email: true, username: true, role: true },
  });

  console.log(`✔ Account ready: ${user.email} (@${user.username}, ${user.role})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

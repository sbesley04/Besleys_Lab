import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// NextAuth configuration — credentials-based, role-aware (ADMIN/EDITOR/USER).
//
// Exported separately from the route handler so it can be reused by
// `getServerSession(authOptions)` inside Server Components and API routes.
//
// Login accepts an email OR a username in the "identifier" field. The JWT and
// session carry id, role, and username so guards and the header can read them.
//
// EXTEND HERE: add OAuth providers to the `providers` array.
// ---------------------------------------------------------------------------

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials.password) return null;

        const id = credentials.identifier.trim().toLowerCase();
        // Trim the password too — trailing whitespace from autofill/paste is a
        // classic "my password is right but login fails" cause. Passwords are
        // hashed from the raw signup value, which signup also trims.
        const password = credentials.password.trim();

        // Look the account up by email or username — whichever matches.
        const user = await prisma.user.findFirst({
          where: { OR: [{ email: id }, { username: id }] },
        });
        if (!user) return null;

        const valid =
          (await bcrypt.compare(password, user.passwordHash)) ||
          // Legacy fallback: hashes created from untrimmed passwords.
          (password !== credentials.password &&
            (await bcrypt.compare(credentials.password, user.passwordHash)));
        if (!valid) return null;

        // Returned object is persisted into the JWT via the callbacks below.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as { id: string; role?: string; username?: string | null };
        token.id = u.id;
        token.role = u.role;
        token.username = u.username ?? null;
      }
      // When the client calls useSession().update() (e.g. after a profile
      // edit), re-read the account so the token/header reflect the change.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { username: true, name: true, role: true },
        });
        if (fresh) {
          token.username = fresh.username;
          token.name = fresh.name;
          token.role = fresh.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Validate the account on every session read (a single PK lookup). This
      // kills ghost sessions for deleted accounts and makes role/username
      // changes take effect without forcing a re-login.
      const fresh = token.id
        ? await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, username: true, name: true, email: true },
          })
        : null;

      if (!fresh) {
        // Account no longer exists — hand back an expired session with no
        // user; every guard (requireUser/requireStaff/useSession) treats it
        // as a guest. (Double cast: our Session augmentation requires `user`.)
        return {
          ...session,
          user: undefined,
          expires: new Date(0).toISOString(),
        } as unknown as typeof session;
      }

      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = fresh.role;
        session.user.username = fresh.username;
        session.user.name = fresh.name;
        session.user.email = fresh.email;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

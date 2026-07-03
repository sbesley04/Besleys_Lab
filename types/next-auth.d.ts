import "next-auth";

// Augment NextAuth types so session/JWT fields are typed everywhere.
// EXTEND HERE if you add more fields to the JWT/session.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      username?: string | null;
      name?: string | null;
      email?: string | null;
    };
  }

  interface User {
    role?: string;
    username?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    username?: string | null;
  }
}

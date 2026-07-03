import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth route handler for the App Router. The actual configuration lives in
// lib/auth.ts so it can be shared with getServerSession() in protected routes.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

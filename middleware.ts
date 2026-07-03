import { withAuth } from "next-auth/middleware";

// Edge-level guard for the admin area — defense in depth on top of the
// per-page requireStaff()/requireAdmin() checks and the per-route API guards.
//
// The `authorized` callback only admits EDITOR/ADMIN tokens, so a logged-out
// visitor OR a plain USER hitting /admin is redirected to /login before the
// route renders. The login page lives outside /admin, so there's no loop and
// the matcher can simply cover the whole /admin tree.
export default withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ token }) => token?.role === "ADMIN" || token?.role === "EDITOR",
  },
});

export const config = {
  matcher: ["/admin/:path*"],
};

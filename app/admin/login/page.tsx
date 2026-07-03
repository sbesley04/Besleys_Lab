import { redirect } from "next/navigation";

// Login moved to the site-wide /login page. This route stays as a permanent
// redirect so old bookmarks keep working.
export default function AdminLoginRedirect() {
  redirect("/login");
}

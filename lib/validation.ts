// Small shared validators for accounts. Kept dependency-free and in one place
// so the API routes, signup, and the CLI script all enforce the same rules.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 3–20 chars, letters/numbers/underscore, must start with a letter or number.
const USERNAME_RE = /^[a-z0-9][a-z0-9_]{2,19}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

// Returns an error message, or null if the password is acceptable.
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

// Returns an error message, or null if the username is acceptable. Compare
// against the lowercased value (usernames are stored/compared lowercase).
export function usernameProblem(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return "Username must be 3–20 characters: letters, numbers, or underscores.";
  }
  return null;
}

export type Role = "ADMIN" | "EDITOR" | "USER";
const ROLES: Role[] = ["ADMIN", "EDITOR", "USER"];

// Coerce arbitrary input to a known role. Defaults to USER (least privilege) —
// privilege is only granted explicitly by an admin, never by accident.
export function normalizeRole(input: unknown): Role {
  return ROLES.includes(input as Role) ? (input as Role) : "USER";
}

export function isStaff(role: string | undefined | null): boolean {
  return role === "ADMIN" || role === "EDITOR";
}

// Content ownership: admins can manage anything; editors only their own items.
export function canEditContent(
  role: string | undefined | null,
  userId: string,
  authorId: string,
): boolean {
  return role === "ADMIN" || userId === authorId;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a Besley's Lab account to save games, rosters, and simulation history.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}

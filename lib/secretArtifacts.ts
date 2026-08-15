// The terminal's hidden rewards share a small set of illustrated field
// artifacts. Keeping paths and labels here means a reward has the same visual
// language in the terminal and the achievement toast.

export const SECRET_ARTIFACTS = {
  shear: { src: "/artifacts/secret-shear.png", label: "Shearing field note" },
  grub: { src: "/artifacts/secret-grub.png", label: "Glowing grub field note" },
  chemist: { src: "/artifacts/secret-chemist.png", label: "Reaction field note" },
  overfit: { src: "/artifacts/secret-overfit.png", label: "Overfit chart field note" },
  lake: { src: "/artifacts/secret-lake.png", label: "Moonlit lake field note" },
  jeb: { src: "/artifacts/secret-jeb.png", label: "Rainbow tag field note" },
} as const;

export type SecretArtifactKey = keyof typeof SECRET_ARTIFACTS;

const BY_ACHIEVEMENT: Record<string, SecretArtifactKey | undefined> = {
  "egg-shear": "shear",
  "egg-grubsong": "grub",
  "egg-chemist": "chemist",
  "egg-overfit": "overfit",
  "egg-rusty": "lake",
  "egg-jeb": "jeb",
};

export function secretArtifactForAchievement(key: string) {
  const artifact = BY_ACHIEVEMENT[key];
  return artifact ? SECRET_ARTIFACTS[artifact] : undefined;
}

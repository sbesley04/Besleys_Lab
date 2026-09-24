// Who's playing — shared by lib/arcade.ts (achievements, results) and
// lib/walletClient.ts (zinc). Split out so those two can import it without
// importing each other.
//
// The root AchievementToaster reports the session here; anything that needs
// to know before the session has resolved waits in a short queue and is
// flushed once it has.

let authState: "unknown" | "signed-in" | "guest" = "unknown";
let pending: Array<(signedIn: boolean) => void> = [];

export function setArcadeAuth(signedIn: boolean) {
  authState = signedIn ? "signed-in" : "guest";
  const queued = pending;
  pending = [];
  queued.forEach((run) => run(signedIn));
}

export function arcadeAuth() {
  return authState;
}

/** Run `fn` with the auth state now if known, otherwise once it is. */
export function whenAuthKnown(fn: (signedIn: boolean) => void) {
  if (authState !== "unknown") fn(authState === "signed-in");
  else if (pending.length < 50) pending.push(fn);
}

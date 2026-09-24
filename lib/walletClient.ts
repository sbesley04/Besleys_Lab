// ---------------------------------------------------------------------------
// Browser side of the zinc wallet (client components only).
//
//   signed in → every action is a POST to /api/wallet; the server decides.
//   guest     → the same engine (lib/wallet.ts) runs here against
//               localStorage. Guests get the full fun; it just lives in
//               one browser.
//
// Every change is broadcast as WALLET_EVENT with the fresh wallet, so the
// counter on the wall, the slot machine, and the prize counter all agree
// without refetching.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { whenAuthKnown } from "@/lib/arcadeAuth";
import {
  accrue, applyAction, dayKey, newWallet, normalizeWallet,
  type Outcome, type Wallet, type WalletAction,
} from "@/lib/wallet";

const LS_WALLET = "bl:wallet";
export const WALLET_EVENT = "bl:wallet-change";

export type ActResult =
  | { ok: true; wallet: Wallet; outcome: Outcome | null; accrued: number }
  | { ok: false; error: string; wallet: Wallet | null };

const tz = () => -new Date().getTimezoneOffset();

function broadcast(wallet: Wallet) {
  window.dispatchEvent(new CustomEvent(WALLET_EVENT, { detail: { wallet } }));
}

/** Show a wallet on every counter on the page without changing anything.
 *  The slot machine uses it to hold back a win until the reels land. */
export const announceWallet = broadcast;

// --- guest wallet (localStorage) ------------------------------------------------

function localTrophyCount(): number {
  try {
    const raw = localStorage.getItem("bl:achievements");
    return raw ? (JSON.parse(raw) as string[]).length : 0;
  } catch {
    return 0;
  }
}

function loadLocal(now: number): Wallet {
  try {
    const raw = localStorage.getItem(LS_WALLET);
    if (raw) return normalizeWallet(JSON.parse(raw), now);
  } catch {
    /* blocked or corrupt — start fresh */
  }
  return newWallet(now, localTrophyCount());
}

function saveLocal(w: Wallet) {
  try {
    localStorage.setItem(LS_WALLET, JSON.stringify(w));
  } catch {
    /* storage blocked — the wallet lasts as long as the page */
  }
}

function actLocal(action: WalletAction | null): ActResult {
  const now = Date.now();
  const { wallet, earned } = accrue(loadLocal(now), now);
  if (!action) {
    saveLocal(wallet);
    return { ok: true, wallet, outcome: null, accrued: earned };
  }
  const res = applyAction(wallet, action, dayKey(now, tz()), Math.random);
  const next = res.ok ? res.wallet : wallet;
  saveLocal(next);
  return res.ok
    ? { ok: true, wallet: next, outcome: res.outcome, accrued: earned }
    : { ok: false, error: res.error, wallet: next };
}

/** Guests only: pay achievement zinc into the local wallet. */
export function creditLocalAchievements(count: number) {
  if (count <= 0) return;
  const res = actLocal({ type: "achievements", count });
  if (res.wallet) broadcast(res.wallet);
}

// --- signed-in wallet (server) ---------------------------------------------------

async function actServer(action: WalletAction | null): Promise<ActResult> {
  try {
    const res = await fetch("/api/wallet", action
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...action, tz: tz() }) }
      : { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error ?? "The wallet didn't answer.", wallet: null };
    return data.ok
      ? { ok: true, wallet: data.wallet, outcome: data.outcome ?? null, accrued: data.accrued ?? 0 }
      : { ok: false, error: data.error, wallet: data.wallet ?? null };
  } catch {
    return { ok: false, error: "Couldn't reach the counter — check your connection.", wallet: null };
  }
}

// --- public API --------------------------------------------------------------------

/**
 * Apply an action (or `null` to just collect passive income and read).
 * `quiet` skips the broadcast — the caller will announceWallet() when ready.
 */
export function walletAct(action: WalletAction | null, { quiet = false } = {}): Promise<ActResult> {
  return new Promise((resolve) => {
    whenAuthKnown((signedIn) => resolve(actAs(signedIn, action, quiet)));
  });
}

async function actAs(signedIn: boolean, action: WalletAction | null, quiet = false): Promise<ActResult> {
  const res = signedIn ? await actServer(action) : actLocal(action);
  if (res.wallet && !quiet) broadcast(res.wallet);
  return res;
}

/**
 * The live wallet. `accrued` is how much passive income the first read on
 * this page collected — the "while you were away" number.
 */
export function useWallet() {
  const { status } = useSession();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accrued, setAccrued] = useState(0);

  useEffect(() => {
    function onChange(e: Event) {
      const next = (e as CustomEvent<{ wallet: Wallet }>).detail?.wallet;
      if (next) setWallet(next);
    }
    window.addEventListener(WALLET_EVENT, onChange);
    return () => window.removeEventListener(WALLET_EVENT, onChange);
  }, []);

  // (Re)load whenever the session settles or changes hands.
  useEffect(() => {
    if (status === "loading") return;
    let live = true;
    // Straight from useSession rather than whenAuthKnown: on a sign-in this
    // effect can run before the toaster has told lib/arcadeAuth.
    const signedIn = status === "authenticated";
    void actAs(signedIn, null).then((res) => {
      if (live && res.ok) setAccrued(res.accrued);
    });
    // Guests: another tab spending zinc should show up here too.
    // Read-only on purpose: writing back would ping-pong between tabs.
    function onStorage(e: StorageEvent) {
      if (e.key !== LS_WALLET || !e.newValue || signedIn) return;
      try {
        setWallet(normalizeWallet(JSON.parse(e.newValue), Date.now()));
      } catch {
        /* ignore a half-written value */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => {
      live = false;
      window.removeEventListener("storage", onStorage);
    };
  }, [status]);

  return { wallet, accrued, signedIn: status === "authenticated" };
}

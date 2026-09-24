import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { parseClientAction } from "@/lib/wallet";
import { WalletBusyError, offsetFrom, withWallet } from "@/lib/walletServer";
import { GAME_SLUGS } from "@/lib/saves";

// The signed-in visitor's zinc wallet.
//   GET  /api/wallet                        → pays passive income, returns the wallet
//   POST /api/wallet { type, ..., tz }       → daily | win {game} | spin {bet} | buy {id}
//
// Every action is resolved here, with a server rng, against the database row —
// the client only animates what it's told. `tz` is minutes east of UTC so the
// daily bonus follows the visitor's calendar. Achievement bonuses are credited
// by /api/achievements itself and can't be requested from here.

const busy = () => NextResponse.json({ error: "The counter is busy — try again in a moment." }, { status: 503 });

export async function GET() {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await withWallet(auth.user.id, null));
  } catch (err) {
    if (err instanceof WalletBusyError) return busy();
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const action = parseClientAction(body);
  if (!action) return NextResponse.json({ error: "Unknown wallet action." }, { status: 400 });
  if (action.type === "win" && !GAME_SLUGS.has(action.game)) {
    return NextResponse.json({ error: "Unknown game." }, { status: 400 });
  }

  let res;
  try {
    res = await withWallet(auth.user.id, action, offsetFrom(body?.tz));
  } catch (err) {
    if (err instanceof WalletBusyError) return busy();
    throw err;
  }
  // A refused action (can't afford it, already claimed) is still a 200 with
  // ok:false — the client shows the message and the fresh balance.
  return NextResponse.json(res);
}

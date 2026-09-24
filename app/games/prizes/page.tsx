import GameFrame from "../_components/GameFrame";
import PrizeCounter from "./PrizeCounter";

// Where zinc gets spent on things that aren't reels. The catalogue lives in
// lib/prizes.ts — add a prize there and it shows up here automatically.
export const metadata = {
  title: "Prize counter",
  description: "Trade the arcade's zinc for game-room decor, upgrades, and small random things.",
};

export default function PrizesPage() {
  return (
    <GameFrame title="Prize counter">
      <PrizeCounter />
    </GameFrame>
  );
}

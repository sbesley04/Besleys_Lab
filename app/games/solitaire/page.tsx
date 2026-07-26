import GameFrame from "../_components/GameFrame";
import Solitaire from "./Solitaire";

export const metadata = {
  title: "Solitaire",
  description: "Klondike, Spider, and FreeCell on graph paper. Undo, timers, and personal bests.",
};

export default function SolitairePage() {
  return (
    <GameFrame title="Solitaire">
      <Solitaire />
    </GameFrame>
  );
}

import GameFrame from "../_components/GameFrame";
import Minesweeper from "./Minesweeper";

export const metadata = {
  title: "Minesweeper",
  description: "Graph-paper Minesweeper with three difficulties, chording, and best times.",
};

export default function MinesweeperPage() {
  return (
    <GameFrame title="Minesweeper">
      <Minesweeper />
    </GameFrame>
  );
}

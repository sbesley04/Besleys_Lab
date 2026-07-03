import GameFrame from "../_components/GameFrame";
import Tetris from "./Tetris";

// Server route that frames the client Tetris component. Keeping the page as a
// server component means only the game itself ships interactivity.
export const metadata = { title: "Tetris" };

export default function TetrisPage() {
  return (
    <GameFrame title="Tetris">
      <Tetris />
    </GameFrame>
  );
}

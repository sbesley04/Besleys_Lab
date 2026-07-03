import GameFrame from "../_components/GameFrame";
import Life from "./Life";

export const metadata = { title: "Game of Life" };

export default function LifePage() {
  return (
    <GameFrame title="Game of Life">
      <Life />
    </GameFrame>
  );
}

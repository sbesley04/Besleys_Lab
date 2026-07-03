import GameFrame from "../_components/GameFrame";
import Snake from "./Snake";

export const metadata = { title: "Snake" };

export default function SnakePage() {
  return (
    <GameFrame title="Snake">
      <Snake />
    </GameFrame>
  );
}

import GameFrame from "../_components/GameFrame";
import Game2048 from "./Game2048";

export const metadata = { title: "2048" };

export default function Page2048() {
  return (
    <GameFrame title="2048">
      <Game2048 />
    </GameFrame>
  );
}

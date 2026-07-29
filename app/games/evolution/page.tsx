import GameFrame from "../_components/GameFrame";
import Evolution from "./Evolution";

export const metadata = {
  title: "Evolution",
  description:
    "A sandbox where creatures with heritable traits compete for food. Set the environment; selection does the rest.",
};

export default function EvolutionPage() {
  return (
    <GameFrame title="Evolution">
      <Evolution />
    </GameFrame>
  );
}

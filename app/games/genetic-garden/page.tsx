import GameFrame from "../_components/GameFrame";
import GeneticGarden from "./GeneticGarden";

export const metadata = { title: "Genetic Garden", description: "Cross-pollinate flowers to breed requested traits and reveal recessive genes." };
export default function Page() { return <GameFrame title="Genetic Garden"><GeneticGarden /></GameFrame>; }

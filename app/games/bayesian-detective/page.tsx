import GameFrame from "../_components/GameFrame";
import BayesianDetective from "./BayesianDetective";

export const metadata = { title: "Bayesian Detective", description: "Spend an inquiry budget, update your beliefs, and make the accusation." };
export default function Page() { return <GameFrame title="Bayesian Detective"><BayesianDetective /></GameFrame>; }

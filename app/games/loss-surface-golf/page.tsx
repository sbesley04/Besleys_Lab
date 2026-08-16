import GameFrame from "../_components/GameFrame";
import LossSurfaceGolf from "./LossSurfaceGolf";

export const metadata = { title: "Loss-Surface Golf", description: "Play five constrained optimization surfaces using SGD, momentum, Adam, and learning-rate schedules." };
export default function Page() { return <GameFrame title="Loss-Surface Golf"><LossSurfaceGolf /></GameFrame>; }

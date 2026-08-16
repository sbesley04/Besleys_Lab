import GameFrame from "../_components/GameFrame";
import LightCycle from "./LightCycle";

export const metadata = { title: "LIGHT-CYCLE", robots: { index: false, follow: false } };

export default function Page() {
  return <GameFrame title="LIGHT-CYCLE // HIDDEN PROGRAM"><LightCycle /></GameFrame>;
}

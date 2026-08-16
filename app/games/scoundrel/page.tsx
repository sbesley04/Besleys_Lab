import GameFrame from "../_components/GameFrame";
import Scoundrel from "./Scoundrel";

export const metadata = { title: "Scoundrel", description: "A standard deck becomes a compact dungeon crawl." };

export default function Page() {
  return <GameFrame title="Scoundrel"><Scoundrel /></GameFrame>;
}

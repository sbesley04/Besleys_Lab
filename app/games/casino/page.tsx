import GameFrame from "../_components/GameFrame";
import SlotMachine from "./SlotMachine";

// The slot machine in the corner of the game room. Not in the arcade
// registry on purpose: it's a place to spend zinc, not a game to "win", so it
// doesn't count toward Lab Rat or the per-game win bonus.
export const metadata = {
  title: "Slot machine",
  description: "Luck o' the Lab — spend the arcade's zinc on a three-reel slot machine.",
};

export default function CasinoPage() {
  return (
    <GameFrame title="Luck o' the Lab">
      <SlotMachine />
    </GameFrame>
  );
}

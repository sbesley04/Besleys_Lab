import GameFrame from "../_components/GameFrame";
import Sudoku from "./Sudoku";

export const metadata = {
  title: "Sudoku",
  description: "Four difficulties, pencil marks, hints, a shared daily puzzle, and streak tracking.",
};

export default function SudokuPage() {
  return (
    <GameFrame title="Sudoku">
      <Sudoku />
    </GameFrame>
  );
}

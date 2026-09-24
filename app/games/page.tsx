import Link from "next/link";
import ArcadeHub from "./ArcadeHub";
import styles from "./arcade.module.css";
import GridText from "@/app/_components/eggs/GridText";

// Arcade hub: a game room you click around in (ArcadeHub → _room/GameRoom, a
// client component because the room has… residents, and a wallet). Still
// driven entirely by ./registry — a new game shows up in the drawer of the
// furniture matching its category, with no edits here.
export const metadata = {
  title: "Games",
  description: "Browser games, strategy challenges, card games, and interactive simulations from Besley’s Lab.",
};

export default function GamesPage() {
  return (
    <main className={styles.hubPage}>
      <Link href="/" className={styles.breadcrumb}>
        <GridText paper="← Home" grid="← ROOT" />
      </Link>
      <header className={styles.hubHeader}>
        <span className={styles.hubKicker}>
          <GridText paper="Playable experiments" grid="Executable programs" />
        </span>
        <h1 className={styles.hubTitle}>
          <GridText paper="Arcade" grid="The Arcade Sector" />
        </h1>
        <p className={styles.hubIntro}>
          <GridText
            paper="Welcome to the game room. Cabinets on the back wall, cards on the table, a slot machine in the corner — and a pocketful of zinc that refills while you're away."
            grid="Programs available for execution. Select a sector and initialize a run."
          />
        </p>
      </header>

      <ArcadeHub />
    </main>
  );
}

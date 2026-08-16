import Link from "next/link";
import ArcadeHub from "./ArcadeHub";
import styles from "./arcade.module.css";
import GridText from "@/app/_components/eggs/GridText";

// Arcade hub. The card grid itself lives in ArcadeHub (a client component,
// because the hub has… residents). Driven entirely by ./registry — to add a
// game, add an entry there and a folder at app/games/<slug>/.
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
            paper="A shelf of quick classics, deeper strategy games, and living simulations — all playable in the browser."
            grid="Programs available for execution. Select a sector and initialize a run."
          />
        </p>
      </header>

      <ArcadeHub />
    </main>
  );
}

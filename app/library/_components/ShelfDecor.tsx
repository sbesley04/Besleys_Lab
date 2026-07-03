import styles from "../library.module.css";
import type { DecorKind } from "@/lib/library";

// Non-book objects that live on the shelves: bookends and the admin-managed
// plants. All inline SVG/CSS so they scale crisply and stay in the palette.

export function Bookend({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={`${styles.bookend} ${side === "left" ? styles.bookendLeft : styles.bookendRight}`}
    />
  );
}

/** A potted snake plant. */
export function PottedPlant() {
  return (
    <svg aria-hidden className={styles.decor} width="64" height="98" viewBox="0 0 64 98">
      <g fill="none">
        {/* leaves */}
        <path d="M32 62 C30 40 28 26 24 12 C33 22 36 42 35 62 Z" fill="#5f7d54" />
        <path d="M28 63 C22 48 16 38 8 30 C20 36 28 48 31 63 Z" fill="#4c6844" />
        <path d="M36 63 C42 46 48 36 56 26 C46 32 38 48 34 63 Z" fill="#71905f" />
        <path d="M31 62 C31 36 32 24 32 6 C36 20 38 44 36 62 Z" fill="#87a86e" />
        {/* pot */}
        <path d="M18 62 L46 62 L42 92 L22 92 Z" fill="#a8552f" />
        <path d="M18 62 L46 62 L45 68 L19 68 Z" fill="#8c4526" />
        <rect x="16" y="58" width="32" height="6" rx="2" fill="#b96437" />
      </g>
    </svg>
  );
}

/** A trailing pothos in a small pot. */
export function TrailingPlant() {
  return (
    <svg aria-hidden className={styles.decor} width="70" height="86" viewBox="0 0 70 86">
      <g fill="none">
        {/* vines trailing over the pot edge */}
        <path d="M28 46 C20 52 16 62 18 76" stroke="#4c6844" strokeWidth="2.5" fill="none" />
        <path d="M42 46 C50 54 54 64 52 80" stroke="#5f7d54" strokeWidth="2.5" fill="none" />
        <ellipse cx="18" cy="60" rx="6" ry="4.5" fill="#5f7d54" transform="rotate(-30 18 60)" />
        <ellipse cx="19" cy="74" rx="6" ry="4.5" fill="#71905f" transform="rotate(-15 19 74)" />
        <ellipse cx="51" cy="62" rx="6" ry="4.5" fill="#71905f" transform="rotate(25 51 62)" />
        <ellipse cx="52" cy="78" rx="6" ry="4.5" fill="#4c6844" transform="rotate(10 52 78)" />
        {/* crown */}
        <ellipse cx="27" cy="40" rx="8" ry="6" fill="#5f7d54" transform="rotate(-20 27 40)" />
        <ellipse cx="35" cy="36" rx="8" ry="6.5" fill="#71905f" />
        <ellipse cx="43" cy="40" rx="8" ry="6" fill="#87a86e" transform="rotate(20 43 40)" />
        {/* pot */}
        <path d="M24 46 L46 46 L43 66 L27 66 Z" fill="#8a8578" />
        <rect x="22" y="43" width="26" height="5" rx="2" fill="#9a958a" />
      </g>
    </svg>
  );
}

/** A tiny cactus for a sparse shelf. */
export function Cactus() {
  return (
    <svg aria-hidden className={styles.decor} width="44" height="70" viewBox="0 0 44 70">
      <g fill="none">
        <rect x="17" y="14" width="10" height="34" rx="5" fill="#71905f" />
        <rect x="7" y="24" width="8" height="14" rx="4" fill="#5f7d54" />
        <rect x="10" y="34" width="9" height="5" fill="#5f7d54" />
        <rect x="29" y="18" width="8" height="18" rx="4" fill="#87a86e" />
        <rect x="25" y="32" width="9" height="5" fill="#87a86e" />
        <path d="M13 48 L31 48 L29 64 L15 64 Z" fill="#a8552f" />
        <rect x="11" y="45" width="22" height="5" rx="2" fill="#b96437" />
      </g>
    </svg>
  );
}

/** A small bonsai in a shallow dish. */
export function Bonsai() {
  return (
    <svg aria-hidden className={styles.decor} width="76" height="76" viewBox="0 0 76 76">
      <g fill="none">
        {/* trunk */}
        <path d="M38 62 C36 52 32 48 28 44 C34 46 36 48 37 50 C37 42 40 36 46 30"
          stroke="#6b543c" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* foliage pads */}
        <ellipse cx="47" cy="26" rx="14" ry="8" fill="#5f7d54" />
        <ellipse cx="26" cy="38" rx="11" ry="6.5" fill="#71905f" />
        <ellipse cx="56" cy="38" rx="9" ry="5.5" fill="#87a86e" />
        {/* dish */}
        <path d="M20 62 L56 62 L53 72 L23 72 Z" fill="#4d5a66" />
        <rect x="17" y="59" width="42" height="5" rx="2.5" fill="#5d6b78" />
      </g>
    </svg>
  );
}

/** Dispatcher: render a decor item by its stored kind. */
export function Decor({ kind }: { kind: DecorKind | string }) {
  switch (kind) {
    case "snake-plant":
      return <PottedPlant />;
    case "pothos":
      return <TrailingPlant />;
    case "cactus":
      return <Cactus />;
    case "bonsai":
      return <Bonsai />;
    default:
      return null;
  }
}

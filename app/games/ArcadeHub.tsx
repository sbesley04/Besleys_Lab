"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./arcade.module.css";
import { games } from "./registry";
import { unlock, localUnlocked } from "@/lib/arcade";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { baa } from "@/lib/sound";

// The arcade hub, client-side: the game-card grid plus its residents —
// a Junimo asleep behind one of the cards, a sheep grazing in the margin,
// the glider salute (earned in Game of Life), and a terminal that opens if
// you type a certain six letters.

export default function ArcadeHub() {
  return (
    <>
      <GliderSalute />
      <GameGrid />
      <Sheep />
      <Terminal />
    </>
  );
}

// --- game cards + Junimo -----------------------------------------------------

function GameGrid() {
  // Where the Junimo naps: a random card, re-rolled when disturbed.
  const [junimoAt, setJunimoAt] = useState<number | null>(null);
  const [junimoLeft, setJunimoLeft] = useState(60);
  const [awake, setAwake] = useState(false);
  const scurrying = useRef(false);

  useEffect(() => {
    setJunimoAt(Math.floor(Math.random() * games.length));
    setJunimoLeft(20 + Math.random() * 60);
  }, []);

  function disturb(i: number) {
    if (i !== junimoAt || scurrying.current) return;
    scurrying.current = true;
    setAwake(true);
    setTimeout(() => {
      let next = Math.floor(Math.random() * games.length);
      if (games.length > 1 && next === i) next = (next + 1) % games.length;
      setJunimoAt(next);
      setJunimoLeft(20 + Math.random() * 60);
      setAwake(false);
      scurrying.current = false;
    }, 620);
  }

  return (
    <div className={styles.grid}>
      {games.map((g, i) => (
        <div key={g.slug} className={styles.cardWrap} onMouseEnter={() => disturb(i)}>
          {junimoAt === i && (
            <span
              className={`${styles.junimo} ${awake ? styles.junimoAwake : ""}`}
              style={{ left: `${junimoLeft}%` }}
              aria-hidden
            >
              <Junimo />
            </span>
          )}
          <Link href={`/games/${g.slug}`} className={`paper-card ${styles.card}`}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", margin: 0 }}>
              {g.title}
            </h2>
            <p style={{ color: "var(--ink-soft)", margin: "0.4rem 0 0", fontSize: "0.92rem" }}>
              {g.blurb}
            </p>
          </Link>
        </div>
      ))}
    </div>
  );
}

// A small forest spirit, very much asleep on the job.
function Junimo() {
  return (
    <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden>
      <path d="M15 6 Q15 2 18 1" fill="none" stroke="#3d7a33" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="18.6" cy="1.4" r="1.6" fill="#57a344" />
      <path d="M4 22 Q4 8 15 8 Q26 8 26 22 Q26 27 15 27 Q4 27 4 22 Z" fill="#57a344" stroke="#3d7a33" strokeWidth="1.4" />
      <circle cx="11" cy="16" r="1.3" fill="#1c3a17" />
      <circle cx="19" cy="16" r="1.3" fill="#1c3a17" />
      <path d="M12.5 20 Q15 21.8 17.5 20" fill="none" stroke="#1c3a17" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

// --- glider salute -----------------------------------------------------------

function GliderSalute() {
  const [earned, setEarned] = useState(false);
  useEffect(() => {
    try {
      setEarned(localStorage.getItem("bl:glider") === "1");
    } catch { /* ignore */ }
  }, []);
  if (!earned) return null;

  const pattern = [false, true, false, false, false, true, true, true, true];
  return (
    <div className={styles.gliderLane} aria-hidden title="Gliderwright">
      <span className={styles.glider}>
        {pattern.map((on, i) => (
          <i key={i} className={on ? styles.gliderOn : undefined} />
        ))}
      </span>
    </div>
  );
}

// --- the sheep ---------------------------------------------------------------

const SHEAR_CLICKS = 5;

function Sheep() {
  const [clicks, setClicks] = useState(0);
  const [shorn, setShorn] = useState(false);
  const [popping, setPopping] = useState(false);
  const [jeb, setJeb] = useState(false);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    try {
      // Wool grows back overnight.
      setShorn(localStorage.getItem("bl:sheep-shorn") === new Date().toDateString());
      setJeb(localStorage.getItem("bl:jeb") === "1");
    } catch { /* ignore */ }
  }, []);

  function poke() {
    if (shorn) {
      baa();
      return;
    }
    setShaking(true);
    setTimeout(() => setShaking(false), 320);
    const n = clicks + 1;
    setClicks(n);
    if (n >= SHEAR_CLICKS) {
      baa();
      setPopping(true);
      setTimeout(() => {
        setShorn(true);
        setPopping(false);
      }, 650);
      unlock("egg-shear");
      try {
        localStorage.setItem("bl:sheep-shorn", new Date().toDateString());
      } catch { /* ignore */ }
    }
  }

  return (
    <div className={styles.sheepWrap}>
      <button
        type="button"
        className={`${styles.sheep} ${shaking ? styles.sheepShake : ""}`}
        onClick={poke}
        aria-label="A sheep, inexplicably"
        title="baa"
      >
        <svg viewBox="0 0 48 34" width="72" height="51">
          {/* legs */}
          <rect x="14" y="26" width="4" height="8" fill="#4a463e" />
          <rect x="30" y="26" width="4" height="8" fill="#4a463e" />
          {/* body wool (blocky, like a certain sandbox game) */}
          {!shorn && (
            <g className={`${popping ? styles.woolPop : ""}`}>
              <rect x="8" y="8" width="32" height="20" rx="2" fill="#f2efe6" stroke="#c9c4b4" strokeWidth="1" className={jeb ? styles.jebWool : ""} />
              <rect x="12" y="4" width="10" height="8" rx="2" fill="#f2efe6" stroke="#c9c4b4" strokeWidth="1" className={jeb ? styles.jebWool : ""} />
            </g>
          )}
          {/* shorn body */}
          {shorn && <rect x="10" y="12" width="28" height="15" rx="3" fill="#e8c6b8" stroke="#c9a290" strokeWidth="1" />}
          {/* head */}
          <rect x="36" y="6" width="10" height="10" rx="1.5" fill="#e8ddc8" stroke="#b8ad98" strokeWidth="1" />
          <rect x="38.5" y="9" width="2.2" height="2.8" fill="#2b2b2b" />
          <rect x="43" y="9" width="2.2" height="2.8" fill="#2b2b2b" />
          <rect x="40" y="13.4" width="4" height="2" fill="#d8a8a0" />
        </svg>
      </button>
    </div>
  );
}

// --- the terminal ------------------------------------------------------------

const SUMMON = "besley";

interface TermLine {
  text: string;
  cls?: "dim" | "accent";
}

function Terminal() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<TermLine[]>([]);
  const [input, setInput] = useState("");
  const [rainbow, setRainbow] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Summon: type "besley" anywhere on the page (outside form fields).
  useEffect(() => {
    let buf = "";
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-SUMMON.length);
      if (buf === SUMMON) {
        buf = "";
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      if (lines.length === 0) {
        print([
          { text: "BESLEY'S LAB terminal v0.53", cls: "accent" },
          { text: "unauthorized access is mildly encouraged. type 'help'." },
        ]);
      }
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [lines]);

  function print(out: TermLine[]) {
    setLines((l) => [...l, ...out].slice(-200));
  }

  function run(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    print([{ text: `> ${cmd}`, cls: "dim" }]);
    const [head, ...rest] = cmd.toLowerCase().split(/\s+/);
    const arg = rest.join(" ");

    switch (head) {
      case "help":
        print([
          { text: "help        this" },
          { text: "motd        message of the day" },
          { text: "stats       your lab record" },
          { text: "theme       change the site's paper" },
          { text: "whoami      identity check" },
          { text: "clear       wipe the screen" },
          { text: "exit        close the terminal" },
          { text: "(some commands are not listed. obviously.)", cls: "dim" },
        ]);
        break;
      case "motd": {
        const motds = [
          "the blueprints for this place have to be around here somewhere.",
          "day 1287 of the experiment. the games are still winning.",
          "reminder: feed the junimo. it lives behind the cards now.",
          "a snake, a spider, and 53 cards walk into a lab...",
          "the sheep is not a bug. the sheep is a feature.",
        ];
        print([{ text: motds[Math.floor(Math.random() * motds.length)] }]);
        break;
      }
      case "stats": {
        const unlocked = localUnlocked();
        print([
          { text: `achievements: ${unlocked.size}/${ACHIEVEMENTS.length} unlocked` },
          { text: unlocked.size === ACHIEVEMENTS.length ? "completionist detected. impressive." : "keep digging.", cls: "dim" },
        ]);
        break;
      }
      case "whoami":
        print([{ text: "a scientist, probably. the lab coat suits you." }]);
        break;
      case "theme":
        if (arg === "blueprint") {
          applyTheme("blueprint");
          print([{ text: "switching to blueprint. mind the wet ink.", cls: "accent" }]);
        } else if (arg === "paper" || arg === "default" || arg === "reset") {
          applyTheme(null);
          print([{ text: "back to paper. cozy." }]);
        } else {
          print([
            { text: "available: paper, ??????" },
            { text: "(the second one is written on the back of this terminal)", cls: "dim" },
          ]);
        }
        break;
      case "blueprint":
        applyTheme("blueprint");
        print([{ text: "ah — found the blueprints. switching.", cls: "accent" }]);
        break;
      case "clear":
        setLines([]);
        break;
      case "exit":
      case "quit":
        setOpen(false);
        break;

      // --- unlisted ---------------------------------------------------------
      case "synthesize":
      case "zni2":
      case "zn+i2": {
        print([
          { text: "loading crucible... Zn (powdered) + I₂ (crystals)" },
          { text: "adding a few drops of H₂O as catalyst..." },
          { text: "⚗️  Zn + I₂ → ZnI₂        ΔH < 0 (vigorously)", cls: "accent" },
          { text: "purple vapor everywhere. the fume hood judges you. lab report due friday." },
        ]);
        unlock("egg-chemist");
        break;
      }
      case "train": {
        print([
          { text: "initializing model... optimizer=adam lr=3e-4" },
          { text: "epoch 1/3  loss 0.6931  val_loss 0.6928" },
          { text: "epoch 2/3  loss 0.2107  val_loss 0.2411" },
          { text: "epoch 3/3  loss 0.0001  val_loss 4.7182", cls: "accent" },
          { text: "training accuracy 100.00%. that is not the flex you think it is." },
          { text: "(did... did you leak the test set into the training data?)", cls: "dim" },
        ]);
        unlock("egg-overfit");
        break;
      }
      case "lake":
      case "rustylake": {
        print([
          { text: "the lake is quiet today." },
          { text: "a crow watches from the mill. it seems to remember you.", cls: "dim" },
          { text: "🦌  \"we will meet again at the bottom of the lake.\"", cls: "accent" },
        ]);
        unlock("egg-rusty");
        break;
      }
      case "jeb_": {
        setRainbow(true);
        try {
          localStorage.setItem("bl:jeb", "1");
        } catch { /* ignore */ }
        print([{ text: "an old name tag glows. the sheep on this page will remember this.", cls: "accent" }]);
        unlock("egg-jeb");
        break;
      }
      case "sudo":
        print([{ text: "nice try. this incident will be reported (to the sheep)." }]);
        break;
      case "konami":
        print([{ text: "↑ ↑ ↓ ↓ ... you know the rest. anywhere on the site.", cls: "dim" }]);
        break;
      default:
        print([{ text: `command not found: ${head}`, cls: "dim" }]);
    }
  }

  function applyTheme(theme: string | null) {
    const html = document.documentElement;
    if (theme) html.dataset.theme = theme;
    else delete html.dataset.theme;
    try {
      if (theme) localStorage.setItem("bl:theme", theme);
      else localStorage.removeItem("bl:theme");
    } catch { /* ignore */ }
  }

  if (!open) return null;

  return (
    <div className={styles.termBackdrop} onClick={() => setOpen(false)}>
      <div
        className={`${styles.terminal} ${rainbow ? styles.termRainbow : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Lab terminal"
      >
        <div className={styles.termHeader}>
          <span>sam@besleys-lab — /dev/arcade</span>
          <button type="button" className={styles.termClose} onClick={() => setOpen(false)} aria-label="Close terminal">
            ✕
          </button>
        </div>
        <div className={styles.termBody} ref={bodyRef}>
          {lines.map((l, i) => (
            <div key={i} className={l.cls === "dim" ? styles.termDim : l.cls === "accent" ? styles.termAccent : undefined}>
              {l.text}
            </div>
          ))}
        </div>
        <form
          className={styles.termInputRow}
          onSubmit={(e) => {
            e.preventDefault();
            run(input);
            setInput("");
          }}
        >
          <span aria-hidden>&gt;</span>
          <input
            ref={inputRef}
            className={styles.termInput}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Terminal command"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
      </div>
    </div>
  );
}
